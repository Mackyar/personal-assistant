import { type AIMessage, getAIProvider, hasRequiredKey } from './client';
import { executeTool, type ToolResult } from './tools';
import { getSettings } from '../db/settings';
import * as chrono from 'chrono-node';
import nlp from 'compromise';

// ─── Local NLP Parsing Helpers ──────────────────────────────────────────────────

function cleanGrammar(text: string): string {
  if (!text) return '';
  try {
    let doc = nlp(text);
    doc.normalize();
    let result = doc.text().trim();
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  } catch (e) {
    console.error('Compromise cleaner failed:', e);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

function parseLocalReminder(text: string): { title: string; dueDate: string; dueTime?: string } {
  try {
    const parsed = chrono.parse(text);
    let title = text;
    let dueDate = new Date().toISOString().slice(0, 10);
    let dueTime: string | undefined;

    if (parsed.length > 0) {
      const match = parsed[0];
      title = text.replace(match.text, '').replace(/\s+/g, ' ').trim();
      const dateObj = match.start.date();
      dueDate = dateObj.toISOString().slice(0, 10);
      
      if (match.start.isCertain('hour')) {
        const h = String(dateObj.getHours()).padStart(2, '0');
        const m = String(dateObj.getMinutes()).padStart(2, '0');
        dueTime = `${h}:${m}`;
      }
    }

    title = cleanGrammar(title) || 'New Reminder';
    return { title, dueDate, dueTime };
  } catch (e) {
    console.error('Chrono reminder parser failed:', e);
    return {
      title: cleanGrammar(text) || 'New Reminder',
      dueDate: new Date().toISOString().slice(0, 10)
    };
  }
}

function parseLocalEvent(text: string): { title: string; date: string; startTime?: string; endTime?: string; allDay: boolean } {
  try {
    const parsed = chrono.parse(text);
    let title = text;
    let date = new Date().toISOString().slice(0, 10);
    let startTime: string | undefined;
    let endTime: string | undefined;
    let allDay = true;

    if (parsed.length > 0) {
      const match = parsed[0];
      title = text.replace(match.text, '').replace(/\s+/g, ' ').trim();
      const dateObj = match.start.date();
      date = dateObj.toISOString().slice(0, 10);
      
      if (match.start.isCertain('hour')) {
        allDay = false;
        const h = String(dateObj.getHours()).padStart(2, '0');
        const m = String(dateObj.getMinutes()).padStart(2, '0');
        startTime = `${h}:${m}`;
        
        if (match.end && match.end.isCertain('hour')) {
          const endDateObj = match.end.date();
          const eh = String(endDateObj.getHours()).padStart(2, '0');
          const em = String(endDateObj.getMinutes()).padStart(2, '0');
          endTime = `${eh}:${em}`;
        }
      }
    }

    title = cleanGrammar(title) || 'New Event';
    return { title, date, startTime, endTime, allDay };
  } catch (e) {
    console.error('Chrono event parser failed:', e);
    return {
      title: cleanGrammar(text) || 'New Event',
      date: new Date().toISOString().slice(0, 10),
      allDay: true
    };
  }
}

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
  const isEventCmd = lowerMsg.startsWith('/event');

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
  if (!isReminderCmd && !isNoteCmd && !isEventCmd && !hasProvider) {
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
    const localParsed = parseLocalReminder(cmdText);
    intentArgs = {
      title: localParsed.title,
      dueDate: localParsed.dueDate,
      dueTime: localParsed.dueTime,
      description: '',
      tags: [],
    };
    
    if (hasProvider && provider) {
      try {
        const prompt = `Extract the reminder details from this text, correcting any spelling, capitalization, and grammar to make it clean, correct, and professional: "${cmdText}"
Today's date: ${new Date().toISOString().slice(0, 10)}
Tomorrow's date: ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}

Respond with ONLY a valid JSON object in this format:
{"title":"<clean, grammar-corrected title>","description":"<clean, grammar-corrected description>","dueDate":"<YYYY-MM-DD>","dueTime":"<HH:MM or null>","tags":["<tag1>"]}

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
    const localParsedTitle = cleanGrammar(cmdText.split('\n')[0]?.slice(0, 50) || 'New Note');
    const localParsedContent = cleanGrammar(cmdText);
    intentArgs = {
      title: localParsedTitle,
      content: localParsedContent,
      tags: [],
      folder: 'root',
    };

    if (hasProvider && provider) {
      try {
        const prompt = `Extract note details from this text, correcting any spelling, capitalization, and grammar to make the title and content clean, correct, and professional: "${cmdText}"

Respond with ONLY a valid JSON object in this format:
{"title":"<clean, grammar-corrected title>","content":"<clean, grammar-corrected content>","tags":["<tag1>"],"folder":"root"}`;
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
  } else if (isEventCmd) {
    intentAction = 'create_event';
    const cmdText = cleanMsg.slice(cleanMsg.toLowerCase().indexOf('/event') + 6).trim();
    const localParsed = parseLocalEvent(cmdText);
    intentArgs = {
      title: localParsed.title,
      date: localParsed.date,
      startTime: localParsed.startTime,
      endTime: localParsed.endTime,
      allDay: localParsed.allDay,
      description: '',
      tags: [],
    };

    if (hasProvider && provider) {
      try {
        const prompt = `Extract the event details from this text, correcting any spelling, capitalization, and grammar to make the title and description clean, correct, and professional: "${cmdText}"
Today's date: ${new Date().toISOString().slice(0, 10)}
Tomorrow's date: ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}

Respond with ONLY a valid JSON object in this format:
{"title":"<clean, grammar-corrected title>","description":"<clean, grammar-corrected description>","date":"<YYYY-MM-DD>","startTime":"<HH:MM or null>","endTime":"<HH:MM or null>","allDay":<true/false>,"location":"<location>","tags":["<tag1>"]}

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
            date: parsed.date || intentArgs.date,
            startTime: parsed.startTime || undefined,
            endTime: parsed.endTime || undefined,
            allDay: parsed.allDay ?? !parsed.startTime,
            description: parsed.description || '',
            location: parsed.location || '',
            tags: parsed.tags || [],
          };
        }
      } catch (e) {
        console.error('Failed to parse event via AI, using fallback:', e);
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
    } else if (intentAction === 'create_event') {
      const timeStr = intentArgs.startTime ? ` at ${intentArgs.startTime}` : '';
      fullContent = `📅 I've created an event: **${intentArgs.title}** on ${intentArgs.date}${timeStr}.`;
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
