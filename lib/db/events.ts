import { db, type CalendarEvent, type Reminder } from './schema';
import { v4 as uuidv4 } from '../utils';

// ─── Events ───────────────────────────────────────────────────────────────────

export async function createEvent(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
  const eventTitle = data.title || 'Untitled Event';
  const eventDate = data.date || new Date().toISOString().slice(0, 10);
  const eventDesc = data.description || '';
  const eventLoc = data.location || '';

  const existing = await db.events
    .filter((e) => 
      e.title === eventTitle &&
      e.date === eventDate &&
      (e.startTime || undefined) === (data.startTime || undefined) &&
      (e.endTime || undefined) === (data.endTime || undefined) &&
      e.description === eventDesc &&
      e.location === eventLoc
    )
    .first();

  if (existing) {
    console.log('Duplicate event detected, skipping creation:', existing);
    return existing;
  }

  const event: CalendarEvent = {
    id: data.id || uuidv4(),
    title: eventTitle,
    description: eventDesc,
    location: eventLoc,
    date: eventDate,
    startTime: data.startTime,
    endTime: data.endTime,
    allDay: data.allDay ?? !data.startTime,
    tags: data.tags || [],
    color: data.color || '#6366f1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.events.add(event);
  return event;
}

export async function updateEvent(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
  await db.events.update(id, { ...data, updatedAt: Date.now() });
  return db.events.get(id);
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.delete(id);
}

export async function getEvents(options?: {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}): Promise<CalendarEvent[]> {
  const all = await db.events.orderBy('date').toArray();
  if (!options?.from && !options?.to) return all;
  return all.filter((e) => {
    if (options.from && e.date < options.from) return false;
    if (options.to && e.date > options.to) return false;
    return true;
  });
}

export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
  return db.events.get(id);
}

export async function searchEventsByText(query: string): Promise<CalendarEvent[]> {
  const lower = query.toLowerCase();
  return db.events
    .filter((e) => e.title.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower))
    .toArray();
}

export async function getTodayEvents(): Promise<CalendarEvent[]> {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${day}`;
  return db.events.where('date').equals(today).toArray();
}

export async function getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const from = `${y}-${m}-${day}`;
  
  const toDate = new Date(d.getTime() + days * 86400000);
  const toY = toDate.getFullYear();
  const toM = String(toDate.getMonth() + 1).padStart(2, '0');
  const toD = String(toDate.getDate()).padStart(2, '0');
  const to = `${toY}-${toM}-${toD}`;
  
  return getEvents({ from, to });
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function createReminder(data: Partial<Reminder>): Promise<Reminder> {
  const reminderTitle = data.title || 'Untitled Reminder';
  const reminderDueDate = data.dueDate || new Date().toISOString().slice(0, 10);
  const reminderDesc = data.description || '';

  const existing = await db.reminders
    .filter((r) => 
      r.title === reminderTitle &&
      r.dueDate === reminderDueDate &&
      (r.dueTime || undefined) === (data.dueTime || undefined) &&
      r.description === reminderDesc
    )
    .first();

  if (existing) {
    console.log('Duplicate reminder detected, skipping creation:', existing);
    return existing;
  }

  const reminder: Reminder = {
    id: data.id || uuidv4(),
    title: reminderTitle,
    description: reminderDesc,
    dueDate: reminderDueDate,
    dueTime: data.dueTime,
    isCompleted: data.isCompleted || false,
    tags: data.tags || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.reminders.add(reminder);
  return reminder;
}

export async function updateReminder(id: string, data: Partial<Reminder>): Promise<Reminder | undefined> {
  await db.reminders.update(id, { ...data, updatedAt: Date.now() });
  return db.reminders.get(id);
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

export async function getReminders(includeCompleted = false): Promise<Reminder[]> {
  if (includeCompleted) return db.reminders.orderBy('dueDate').toArray();
  return db.reminders.filter((r) => !r.isCompleted).sortBy('dueDate');
}

export async function getUpcomingReminders(days = 7): Promise<Reminder[]> {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return db.reminders
    .filter((r) => !r.isCompleted && r.dueDate >= from && r.dueDate <= to)
    .sortBy('dueDate');
}
