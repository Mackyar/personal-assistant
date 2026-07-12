import { type AIMessage, getAIProvider, hasRequiredKey } from './client';
import { executeTool, type ToolResult } from './tools';
import { getSettings } from '../db/settings';

// ─── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return `You are a personal AI assistant — an intelligent second brain.
Today is ${dayName}, ${todayStr}. Tomorrow is ${tomorrowStr}.

Your capabilities:
- Save notes, events, reminders when the user mentions them
- Retrieve and search the user's stored information
- Answer questions about their schedule, notes, and tasks
- Have natural conversations

Keep your responses friendly, concise, and helpful. When you save something, confirm what you saved.`;
}

// ─── Intent Detection Prompt ────────────────────────────────────────────────────

function buildIntentPrompt(userMessage: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return `Analyze this message and respond with ONLY a valid JSON object. No markdown, no explanation, just JSON.

Message: "${userMessage}"

Today's date: ${today}
Tomorrow's date: ${tomorrow}

Respond with ONE of these JSON formats:

If creating an event/meeting/class/appointment:
{"action":"create_event","title":"<title>","date":"<YYYY-MM-DD>","startTime":"<HH:MM or null>","endTime":"<HH:MM or null>","allDay":<true/false>,"description":"<description>","location":"<location>","tags":["<tag1>"]}

If creating a note/saving information:
{"action":"create_note","title":"<title>","content":"<content>","tags":["<tag1>"],"folder":"root"}

If creating a reminder/task/todo:
{"action":"create_reminder","title":"<title>","description":"<description>","dueDate":"<YYYY-MM-DD>","dueTime":"<HH:MM or null>","tags":["<tag1>"]}

If asking about schedule/events:
{"action":"get_schedule","period":"today|tomorrow|week|month"}

If searching for something:
{"action":"search_memory","query":"<query>","type":"all|note|event|reminder"}

If asking about reminders/deadlines:
{"action":"get_reminders","days":7}

If just having a conversation (no data action needed):
{"action":"conversation"}

Rules:
- "tomorrow" = ${tomorrow}
- "today" = ${today}
- Extract time from natural language (e.g. "9:30 am" = "09:30", "3pm" = "15:00")
- If time mentioned, allDay=false. If no time, allDay=true
- CRITICAL: If the user explicitly starts with "Note:" or says "make a note", you MUST use action: "create_note", NOT create_reminder.
- Infer reasonable tags from context (e.g. "class" → ["class","education"])
- Only use action:"conversation" if no clear data operation is intended`;
}

// ─── Stream Chunk Type ──────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'delta' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

export interface ChatResponse {
  content: string;
  toolResults: ToolResult[];
}

// ─── Main Chat Function ─────────────────────────────────────────────────────────

export async function processChat(
  messages: AIMessage[],
  onChunk?: (chunk: StreamChunk) => void,
  onToolResult?: (result: ToolResult) => void,
): Promise<ChatResponse> {
  const settings = await getSettings();
  const userMessage = messages[messages.length - 1]?.content || '';
  const cleanMsg = userMessage.trim();
  const lowerMsg = cleanMsg.toLowerCase();
  const isReminderCmd = lowerMsg.startsWith('/reminder');
  const isNoteCmd = lowerMsg.startsWith('/note');

  let provider: any;
  let hasProvider = false;
  if (hasRequiredKey(settings)) {
    try {
      provider = await getAIProvider(settings);
      hasProvider = true;
    } catch (err) {
      console.warn('AI Provider load failed:', err);
    }
  }

  // If not a command and we don't have a provider, show the warning
  if (!isReminderCmd && !isNoteCmd && !hasProvider) {
    const msg = settings.activeProvider === 'ollama'
      ? '⚠️ Ollama is selected but may not be running. Please start Ollama or switch to a cloud provider in Settings.'
      : '⚠️ No API key configured. Please go to **Settings** and add your API key to get started.';
    onChunk?.({ type: 'delta', content: msg });
    onChunk?.({ type: 'done' });
    return { content: msg, toolResults: [] };
  }

  const toolResults: ToolResult[] = [];

  // ── Stage 1: Detect intent via JSON extraction ────────────────────────────
  let intentAction: string = 'conversation';
  let intentArgs: Record<string, unknown> = {};

  if (isReminderCmd) {
    intentAction = 'create_reminder';
    const cmdText = cleanMsg.slice(cleanMsg.toLowerCase().indexOf('/reminder') + 9).trim();
    // Default values if AI extraction fails/offline
    intentArgs = {
      title: cmdText || 'New Reminder',
      dueDate: new Date().toISOString().slice(0, 10),
      description: '',
      tags: [],
    };
    
    if (hasProvider && provider) {
      try {
        const prompt = `Extract the reminder details from this text: "${cmdText}"
Today's date: ${new Date().toISOString().slice(0, 10)}
Tomorrow's date: ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}

Respond with ONLY a valid JSON object in this format:
{"title":"<title>","description":"<description>","dueDate":"<YYYY-MM-DD>","dueTime":"<HH:MM or null>","tags":["<tag1>"]}

Rules:
- "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
- "today" = ${new Date().toISOString().slice(0, 10)}
- Extract time from natural language (e.g. "9:30 am" = "09:30", "3pm" = "15:00")`;
        const response = await provider.chat([{ role: 'user', content: prompt }]);
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.title) {
          intentArgs = {
            title: parsed.title,
            dueDate: parsed.dueDate || intentArgs.dueDate,
            dueTime: parsed.dueTime || undefined,
            description: parsed.description || '',
            tags: parsed.tags || [],
          };
        }
      } catch (e) {
        console.error('Failed to parse reminder via AI, using fallback:', e);
      }
    }
  } else if (isNoteCmd) {
    intentAction = 'create_note';
    const cmdText = cleanMsg.slice(cleanMsg.toLowerCase().indexOf('/note') + 5).trim();
    // Default values if AI extraction fails/offline
    intentArgs = {
      title: cmdText.split('\n')[0]?.slice(0, 50) || 'New Note',
      content: cmdText,
      tags: [],
      folder: 'root',
    };

    if (hasProvider && provider) {
      try {
        const prompt = `Extract note details from this text: "${cmdText}"

Respond with ONLY a valid JSON object in this format:
{"title":"<title>","content":"<content>","tags":["<tag1>"],"folder":"root"}`;
        const response = await provider.chat([{ role: 'user', content: prompt }]);
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.title && parsed.content) {
          intentArgs = {
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags || [],
            folder: parsed.folder || 'root',
          };
        }
      } catch (e) {
        console.error('Failed to parse note via AI, using fallback:', e);
      }
    }
  } else if (hasProvider && provider) {
    try {
      const intentResponse = await provider.chat([
        { role: 'user', content: buildIntentPrompt(userMessage) },
      ]);

      // Extract JSON from response (strip any markdown fences)
      const cleaned = intentResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      intentAction = parsed.action || 'conversation';
      const { action: _a, ...rest } = parsed;
      intentArgs = rest;
    } catch {
      // Intent detection failed — treat as conversation
      intentAction = 'conversation';
    }
  }

  // ── Stage 2: Execute tool if needed ───────────────────────────────────────
  let toolContext = '';

  if (intentAction !== 'conversation') {
    try {
      const toolResult = await executeTool(
        intentAction,
        intentArgs,
        async (text) => {
          if (hasProvider && provider) {
            try { return await provider.embed(text); } catch { return []; }
          }
          return [];
        }
      );
      toolResults.push(toolResult);
      onToolResult?.(toolResult);
      toolContext = `\n[Tool executed: ${toolResult.displayText}]\n[Result: ${JSON.stringify(toolResult.result)}]`;
    } catch (err) {
      toolContext = `\n[Tool failed: ${err instanceof Error ? err.message : 'unknown error'}]`;
    }
  }

  // ── Stage 3: Generate natural language response ───────────────────────────
  let fullContent = '';

  if (!hasProvider) {
    // If no provider (offline fallback for commands), return a simple static message
    if (intentAction === 'create_reminder') {
      fullContent = `⏰ I've set a reminder: **${intentArgs.title}** by ${intentArgs.dueDate}.`;
    } else if (intentAction === 'create_note') {
      fullContent = `📝 I've saved a new note: **${intentArgs.title}**.`;
    } else {
      fullContent = `⚠️ AI assistant is currently offline. Please configure your provider in Settings.`;
    }
    onChunk?.({ type: 'delta', content: fullContent });
    onChunk?.({ type: 'done' });
    return { content: fullContent, toolResults };
  }

  const conversationHistory = messages.slice(0, -1); // All previous messages
  const contextualMessage = toolContext
    ? `${userMessage}\n\n${toolContext}\n\nNow respond naturally to the user based on what was done. Be brief and friendly.`
    : userMessage;

  const fullMessages: AIMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory,
    { role: 'user', content: contextualMessage },
  ];

  try {
    fullContent = await provider.stream(fullMessages, undefined, (chunk: any) => {
      if (chunk.type === 'delta' && chunk.content) {
        fullContent += chunk.content;
        onChunk?.({ type: 'delta', content: chunk.content });
      } else if (chunk.type === 'done') {
        onChunk?.({ type: 'done' });
      }
    });
  } catch (error: unknown) {
    const msg = `❌ Error generating response: ${error instanceof Error ? error.message : 'Unknown error. Check your API key and model in Settings.'}`;
    onChunk?.({ type: 'delta', content: msg });
    onChunk?.({ type: 'done' });
    return { content: msg, toolResults };
  }

  // If stream didn't emit done, emit it now
  if (fullContent) {
    onChunk?.({ type: 'done' });
  }

  return { content: fullContent, toolResults };
}
