'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, CheckSquare, Square, Clock } from 'lucide-react';
import { db } from '@/lib/db/schema';
import type { Reminder } from '@/lib/db/schema';
import { createReminder, updateReminder, deleteReminder, getReminders } from '@/lib/db/events';
import { cn, formatRelativeDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [showCompleted]);

  async function loadReminders() {
    const all = await getReminders(true);
    if (showCompleted) {
      setReminders(all);
    } else {
      setReminders(all.filter((r) => !r.isCompleted));
    }
  }

  async function toggleStatus(reminder: Reminder) {
    await updateReminder(reminder.id, { isCompleted: !reminder.isCompleted });
    loadReminders();
  }

  async function handleDelete(id: string) {
    await deleteReminder(id);
    loadReminders();
    toast.success('Reminder deleted');
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <h1 className="text-lg font-semibold">Reminders</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input 
              type="checkbox" 
              checked={showCompleted} 
              onChange={(e) => setShowCompleted(e.target.checked)} 
              className="w-3.5 h-3.5 accent-primary"
            />
            Show Completed
          </label>
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} />
            New
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
            <CheckSquare size={32} className="mb-3 text-muted-foreground" />
            <p className="text-sm">No reminders found.</p>
          </div>
        ) : (
          reminders.map((reminder) => (
            <div key={reminder.id} className={cn(
              "flex items-start justify-between gap-3 p-4 rounded-xl border transition-all",
              reminder.isCompleted ? "bg-card/50 border-border/50 opacity-60" : "bg-card border-border hover:border-primary/30"
            )}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button onClick={() => toggleStatus(reminder)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {reminder.isCompleted ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-sm font-medium", reminder.isCompleted && "line-through")}>{reminder.title}</h3>
                  {reminder.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reminder.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={cn("flex items-center gap-1 text-[10px]", reminder.dueDate < new Date().toISOString().slice(0, 10) && !reminder.isCompleted ? "text-destructive" : "text-muted-foreground")}>
                      <CalendarIcon size={10} />
                      {reminder.dueDate}
                    </span>
                    {reminder.dueTime && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock size={10} />
                        {reminder.dueTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(reminder.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ReminderModal 
          onClose={() => setModalOpen(false)} 
          onSave={async (data) => {
            await createReminder(data);
            setModalOpen(false);
            loadReminders();
            toast.success('Reminder added');
          }} 
        />
      )}
    </div>
  );
}

function ReminderModal({ onClose, onSave }: { onClose: () => void, onSave: (data: Partial<Reminder>) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl fade-in">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">New Reminder</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ title, description, dueDate, dueTime }); }} className="p-5 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reminder title..."
            required
            className="input-base w-full"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)..."
            rows={2}
            className="input-base w-full resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="input-base w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time (optional)</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="input-base w-full" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost border border-border text-xs">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="flex-1 btn-primary text-xs">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
