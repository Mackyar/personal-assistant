import { db, type Note } from './schema';
import { v4 as uuidv4 } from '../utils';

export async function createNote(data: Partial<Note>): Promise<Note> {
  const noteTitle = data.title || 'Untitled Note';
  const noteContentText = data.contentText || '';

  const existing = await db.notes
    .filter((n) => 
      n.title === noteTitle &&
      n.contentText === noteContentText
    )
    .first();

  if (existing) {
    console.log('Duplicate note detected, skipping creation:', existing);
    return existing;
  }

  const note: Note = {
    id: data.id || uuidv4(),
    title: noteTitle,
    content: data.content || '{"type":"doc","content":[]}',
    contentText: noteContentText,
    tags: data.tags || [],
    folder: data.folder || 'root',
    isPinned: data.isPinned || false,
    isArchived: data.isArchived || false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.notes.add(note);
  return note;
}

export async function updateNote(id: string, data: Partial<Note>): Promise<Note | undefined> {
  await db.notes.update(id, { ...data, updatedAt: Date.now() });
  return db.notes.get(id);
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
  // Also delete associated embeddings
  const embs = await db.embeddings.where('refId').equals(id).toArray();
  for (const e of embs) await db.embeddings.delete(e.id);
}

export async function getNotes(options?: {
  folder?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
  limit?: number;
}): Promise<Note[]> {
  let query = db.notes.orderBy('updatedAt').reverse();
  const arr = await query.toArray();
  return arr.filter((n) => {
    if (options?.folder && n.folder !== options.folder) return false;
    if (options?.isPinned !== undefined && n.isPinned !== options.isPinned) return false;
    if (options?.isArchived !== undefined && n.isArchived !== options.isArchived) return false;
    if (options?.tags?.length && !options.tags.some((t) => n.tags.includes(t))) return false;
    return true;
  }).slice(0, options?.limit || 1000);
}

export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function searchNotesByText(query: string): Promise<Note[]> {
  const lower = query.toLowerCase();
  return db.notes
    .filter((n) => n.title.toLowerCase().includes(lower) || n.contentText.toLowerCase().includes(lower))
    .toArray();
}
