'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Calendar as CalendarIcon,
  CheckSquare, Square, Clock, AlertCircle, ListTodo, X
} from 'lucide-react';
import type { Reminder } from '@/lib/db/schema';
import { createReminder, updateReminder, deleteReminder, getReminders } from '@/lib/db/events';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type FilterTab = 'all' | 'pending' | 'overdue' | 'completed';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Done' },
];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { loadReminders(); }, []);

  async function loadReminders() {
    const all = await getReminders(true);
    setReminders(all.sort((a, b) => {
      // Sort: overdue first, then by dueDate asc, completed last
      if (a.isCompleted && !b.isCompleted) return 1;
      if (!a.isCompleted && b.isCompleted) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }));
  }

  async function toggleStatus(reminder: Reminder) {
    await updateReminder(reminder.id, { isCompleted: !reminder.isCompleted });
    await loadReminders();
    toast.success(reminder.isCompleted ? 'Marked as pending' : 'Marked as done!');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reminder?')) return;
    await deleteReminder(id);
    await loadReminders();
    toast.success('Reminder deleted');
  }

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let list = reminders;
    if (activeTab === 'pending') list = list.filter((r) => !r.isCompleted && r.dueDate >= today);
    else if (activeTab === 'overdue') list = list.filter((r) => !r.isCompleted && r.dueDate < today);
    else if (activeTab === 'completed') list = list.filter((r) => r.isCompleted);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [reminders, activeTab, search, today]);

  const overdueCnt = reminders.filter((r) => !r.isCompleted && r.dueDate < today).length;
  const pendingCnt = reminders.filter((r) => !r.isCompleted && r.dueDate >= today).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-primary" />
          <h1 className="text-lg font-semibold">Reminders</h1>
          {overdueCnt > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-medium">
              <AlertCircle size={10} />
              {overdueCnt} overdue
            </span>
          )}
        </div>
        <button
          id="new-reminder-btn"
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1.5 px-4 py-2 border-b border-border bg-card/20 scrollbar-none whitespace-nowrap">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === 'all' ? reminders.length
            : tab.id === 'pending' ? pendingCnt
            : tab.id === 'overdue' ? overdueCnt
            : reminders.filter((r) => r.isCompleted).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border border-border',
                isActive
                  ? tab.id === 'overdue'
                    ? 'bg-destructive/15 border-destructive/30 text-destructive font-medium'
                    : 'bg-primary/10 border-primary/30 text-primary font-medium'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                isActive
                  ? tab.id === 'overdue' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reminders..."
            className="w-full !pl-9 input-base text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 py-16">
            <CheckSquare size={36} className="mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {search ? 'No results found' : activeTab === 'overdue' ? 'No overdue reminders 🎉' : 'Nothing here yet'}
            </p>
            {!search && activeTab !== 'overdue' && (
              <button onClick={() => setModalOpen(true)} className="mt-3 btn-primary text-xs">
                Add a reminder
              </button>
            )}
          </div>
        ) : (
          filtered.map((reminder) => {
            const isOverdue = !reminder.isCompleted && reminder.dueDate < today;
            const isToday = reminder.dueDate === today;
            return (
              <div
                key={reminder.id}
                className={cn(
                  'group flex items-start gap-3 p-4 rounded-xl border transition-all',
                  reminder.isCompleted
                    ? 'bg-card/40 border-border/40 opacity-60'
                    : isOverdue
                    ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                    : 'bg-card border-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleStatus(reminder)}
                  className={cn(
                    'mt-0.5 flex-shrink-0 transition-colors',
                    reminder.isCompleted ? 'text-primary' : isOverdue ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-primary'
                  )}
                >
                  {reminder.isCompleted
                    ? <CheckSquare size={17} />
                    : <Square size={17} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={cn('text-sm font-medium', reminder.isCompleted && 'line-through text-muted-foreground')}>
                    {reminder.title}
                  </h3>
                  {reminder.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{reminder.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={cn(
                      'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium',
                      isOverdue ? 'bg-destructive/15 text-destructive' : isToday ? 'bg-amber-500/15 text-amber-500' : 'bg-secondary text-muted-foreground'
                    )}>
                      <CalendarIcon size={9} />
                      {isOverdue ? `Overdue · ` : isToday ? 'Today · ' : ''}{reminder.dueDate}
                    </span>
                    {reminder.dueTime && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock size={9} />
                        {reminder.dueTime}
                      </span>
                    )}
                    {reminder.tags?.map((tag) => (
                      <span key={tag} className="tag-pill">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(reminder.id)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <ReminderModal
          onClose={() => setModalOpen(false)}
          onSave={async (data) => {
            await createReminder(data);
            setModalOpen(false);
            await loadReminders();
            toast.success('Reminder added!');
          }}
        />
      )}
    </div>
  );
}

function ReminderModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: Partial<Reminder>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">New Reminder</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-muted-foreground hover:text-foreground">
            <X size={15} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ title, description, dueDate, dueTime: dueTime || undefined });
          }}
          className="p-5 space-y-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to remember?"
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
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="input-base w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time (optional)</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="input-base w-full"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost border border-border text-xs">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()} className="flex-1 btn-primary text-xs">
              Save Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
