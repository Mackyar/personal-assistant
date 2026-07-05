import { createNote, updateNote, getNotes, searchNotesByText } from '../db/notes';
import { createEvent, updateEvent, getEvents, getTodayEvents, getUpcomingEvents, searchEventsByText } from '../db/events';
import { createReminder, getReminders, getUpcomingReminders } from '../db/events';
import { upsertEmbedding, searchByEmbedding } from '../db/embeddings';
import { db } from '../db/schema';
import type { ToolDefinition } from './client';
import { v4 as uuidv4 } from '../utils';

// ─── Tool Definitions (for OpenAI function calling) ───────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_note',
    description: 'Create a new note with title, content, tags, and folder. Use when user wants to save text, ideas, or information.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Plain text content of the note' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Relevant tags' },
        folder: { type: 'string', description: 'Folder name, default "root"' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'create_event',
    description: 'Create a calendar event. Use when user mentions meetings, appointments, deadlines, or any time-specific activity.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        startTime: { type: 'string', description: 'Start time in HH:MM format (24h), optional' },
        endTime: { type: 'string', description: 'End time in HH:MM format (24h), optional' },
        allDay: { type: 'boolean', description: 'Whether this is an all-day event' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'create_reminder',
    description: 'Create a reminder with a due date. Use when user mentions needing to remember something by a date.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Reminder title' },
        description: { type: 'string', description: 'Reminder details' },
        dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        dueTime: { type: 'string', description: 'Due time in HH:MM format, optional' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'dueDate'],
    },
  },
  {
    name: 'search_memory',
    description: 'Search all stored notes, events, and reminders. Use when user asks questions about stored information, wants to recall something, or queries their data.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: { type: 'string', enum: ['note', 'event', 'reminder', 'all'], description: 'Type to search' },
        dateFrom: { type: 'string', description: 'Filter events from date YYYY-MM-DD, optional' },
        dateTo: { type: 'string', description: 'Filter events to date YYYY-MM-DD, optional' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Get today\'s or upcoming schedule. Use when user asks what they are doing today, tomorrow, or this week.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'tomorrow', 'week', 'month'], description: 'Time period' },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_reminders',
    description: 'Get pending reminders and deadlines.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look ahead N days, default 7' },
      },
    },
  },
];

// ─── Tool Execution ────────────────────────────────────────────────────────────

export interface ToolResult {
  toolName: string;
  result: unknown;
  displayText: string;
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  embedFn?: (text: string) => Promise<number[]>
): Promise<ToolResult> {
  switch (toolName) {
    case 'create_note': {
      const note = await createNote({
        title: args.title as string,
        contentText: args.content as string,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: args.content }] }] }),
        tags: (args.tags as string[]) || [],
        folder: (args.folder as string) || 'root',
      });
      // Store embedding
      if (embedFn) {
        try {
          const vector = await embedFn(`${note.title} ${note.contentText}`);
          await upsertEmbedding(note.id, 'note', `${note.title} ${note.contentText}`, vector);
        } catch {}
      }
      return { toolName, result: note, displayText: `✅ Note saved: **${note.title}**` };
    }

    case 'create_event': {
      const event = await createEvent({
        title: args.title as string,
        description: (args.description as string) || '',
        location: (args.location as string) || '',
        date: args.date as string,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        allDay: (args.allDay as boolean) ?? !args.startTime,
        tags: (args.tags as string[]) || [],
      });
      if (embedFn) {
        try {
          const vector = await embedFn(`${event.title} ${event.description} ${event.date}`);
          await upsertEmbedding(event.id, 'event', `${event.title} ${event.description}`, vector);
        } catch {}
      }
      const timeStr = event.startTime ? ` at ${event.startTime}` : '';
      return { toolName, result: event, displayText: `📅 Event created: **${event.title}** on ${event.date}${timeStr}` };
    }

    case 'create_reminder': {
      const reminder = await createReminder({
        title: args.title as string,
        description: (args.description as string) || '',
        dueDate: args.dueDate as string,
        dueTime: args.dueTime as string | undefined,
        tags: (args.tags as string[]) || [],
      });
      return { toolName, result: reminder, displayText: `⏰ Reminder set: **${reminder.title}** by ${reminder.dueDate}` };
    }

    case 'search_memory': {
      const query = args.query as string;
      const type = (args.type as string) || 'all';
      const results: unknown[] = [];

      if (type === 'note' || type === 'all') {
        const notes = await searchNotesByText(query);
        results.push(...notes.slice(0, 5).map((n) => ({ type: 'note', id: n.id, title: n.title, snippet: n.contentText.slice(0, 200), updatedAt: n.updatedAt })));
      }
      if (type === 'event' || type === 'all') {
        const events = await searchEventsByText(query);
        results.push(...events.slice(0, 5).map((e) => ({ type: 'event', id: e.id, title: e.title, date: e.date, startTime: e.startTime })));
      }
      if (type === 'reminder' || type === 'all') {
        const reminders = await db.reminders.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())).toArray();
        results.push(...reminders.slice(0, 5).map((r) => ({ type: 'reminder', id: r.id, title: r.title, dueDate: r.dueDate })));
      }

      return {
        toolName,
        result: results,
        displayText: results.length > 0
          ? `🔍 Found ${results.length} result(s) for "${query}"`
          : `🔍 No results found for "${query}"`,
      };
    }

    case 'get_schedule': {
      const period = args.period as string;
      let events: unknown[] = [];
      let label = '';

      if (period === 'today') {
        events = await getTodayEvents();
        label = "Today's schedule";
      } else if (period === 'tomorrow') {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        events = await getEvents({ from: tomorrow, to: tomorrow });
        label = "Tomorrow's schedule";
      } else if (period === 'week') {
        events = await getUpcomingEvents(7);
        label = 'This week';
      } else {
        events = await getUpcomingEvents(30);
        label = 'This month';
      }

      return {
        toolName,
        result: { period, events, label },
        displayText: `📅 ${label}: ${events.length} event(s)`,
      };
    }

    case 'get_reminders': {
      const days = (args.days as number) || 7;
      const reminders = await getUpcomingReminders(days);
      return {
        toolName,
        result: reminders,
        displayText: `⏰ ${reminders.length} upcoming reminder(s) in the next ${days} days`,
      };
    }

    default:
      return { toolName, result: null, displayText: `Unknown tool: ${toolName}` };
  }
}
