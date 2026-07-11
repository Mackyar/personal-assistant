import Dexie, { type EntityTable } from 'dexie';

export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON string
  contentText: string; // Plain text for search
  tags: string[];
  folder: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  embeddingId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO date string YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay: boolean;
  location?: string;
  tags: string[];
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date string
  dueTime?: string;
  isCompleted: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  createdAt: number;
}

export interface Attachment {
  id: string;
  messageId?: string;
  noteId?: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
  createdAt: number;
}

export interface EmbeddingRecord {
  id: string;
  refId: string; // ID of the note/event/reminder
  refType: 'note' | 'event' | 'reminder';
  text: string;
  vector: number[];
  createdAt: number;
}

export interface AppSettings {
  id: string; // Always 'settings'
  activeProvider: 'openai' | 'gemini' | 'anthropic' | 'openrouter' | 'ollama' | 'llm7';
  activeModel: string;
  openaiKey?: string;
  openaiModel: string;
  geminiKey?: string;
  geminiModel: string;
  anthropicKey?: string;
  anthropicModel: string;
  openrouterKey?: string;
  openrouterModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  llm7Key?: string;
  llm7Model: string;
  theme: 'dark' | 'light' | 'system';
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  supabaseUrl?: string;
  supabaseKey?: string;
  updatedAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
}

class PersonalAssistantDB extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;
  messages!: EntityTable<Message, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  embeddings!: EntityTable<EmbeddingRecord, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  folders!: EntityTable<Folder, 'id'>;

  constructor() {
    super('PersonalAssistantDB');
    this.version(1).stores({
      notes: 'id, title, folder, isPinned, isArchived, createdAt, updatedAt',
      events: 'id, title, date, createdAt, updatedAt',
      reminders: 'id, title, dueDate, isCompleted, createdAt, updatedAt',
      conversations: 'id, title, createdAt, updatedAt',
      messages: 'id, conversationId, role, createdAt',
      attachments: 'id, messageId, noteId, createdAt',
      embeddings: 'id, refId, refType, createdAt',
      settings: 'id',
      tags: 'id, name',
      folders: 'id, name, parentId',
    });
  }
}

export const db = new PersonalAssistantDB();

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  activeProvider: 'llm7',
  activeModel: 'gpt-5.4-mini',
  openaiModel: 'gpt-4o-mini',
  geminiModel: 'gemini-1.5-flash',
  anthropicModel: 'claude-3-haiku-20240307',
  openrouterModel: 'openai/gpt-4o-mini',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  llm7Model: 'gpt-5.4-mini',
  theme: 'dark',
  weekStartsOn: 1, // Monday by default
  updatedAt: Date.now(),
};

