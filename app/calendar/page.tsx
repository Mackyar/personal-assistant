'use client';

import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Plus, X, Trash2, Edit2, Upload } from 'lucide-react';
import { getEvents, createEvent, updateEvent, deleteEvent } from '@/lib/db/events';
import { getSettings as getAppSettings } from '@/lib/db/settings';
import { formatTime, EVENT_COLORS } from '@/lib/utils';
import type { CalendarEvent } from '@/lib/db/schema';
import toast from 'react-hot-toast';
import { ImportModal } from './ImportModal';
import { MobileMonthView } from './MobileMonthView';

interface EventModalState {
  open: boolean;
  mode: 'create' | 'edit';
  event?: CalendarEvent;
  defaultDate?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modal, setModal] = useState<EventModalState>({ open: false, mode: 'create' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [firstDay, setFirstDay] = useState<0 | 1>(1);
  const [selectedRange, setSelectedRange] = useState<{ start: string, end: string } | null>(null);
  const [mobileView, setMobileView] = useState<'month' | 'week' | 'day'>('month');
  const [isMobile, setIsMobile] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    loadEvents();
    getAppSettings().then(s => setFirstDay(s.weekStartsOn ?? 1));
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  async function loadEvents() {
    const all = await getEvents();
    setEvents(all);
  }

  function toFCEvents(events: CalendarEvent[]): object[] {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.startTime ? `${e.date}T${e.startTime}` : e.date,
      end: e.endTime ? `${e.date}T${e.endTime}` : undefined,
      allDay: e.allDay,
      backgroundColor: e.color,
      borderColor: e.color,
      extendedProps: { event: e },
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleEventDrop(arg: any) {
    const ev = arg.event.extendedProps.event as CalendarEvent;
    const newDate = arg.event.startStr.slice(0, 10);
    await updateEvent(ev.id, { date: newDate });
    loadEvents();
    toast.success('Event moved');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelect(arg: any) {
    setSelectedRange({ start: arg.startStr.slice(0, 10), end: arg.endStr.slice(0, 10) });
  }

  function handleUnselect() {
    setSelectedRange(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleDateClick(arg: any) {
    // If they just click a date, we could open the modal, but FullCalendar select will also fire.
    // If they double click or just want to add, they can use the Add Event button.
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEventClick(arg: any) {
    const ev = arg.event.extendedProps.event as CalendarEvent;
    setModal({ open: true, mode: 'edit', event: ev });
  }

  async function handleSave(data: Partial<CalendarEvent>) {
    if (modal.mode === 'create') {
      await createEvent(data);
      toast.success('Event created');
    } else if (modal.event) {
      await updateEvent(modal.event.id, data);
      toast.success('Event updated');
    }
    setModal({ open: false, mode: 'create' });
    loadEvents();
  }

  async function handleDelete() {
    if (modal.event) {
      await deleteEvent(modal.event.id);
      toast.success('Event deleted');
      setModal({ open: false, mode: 'create' });
      loadEvents();
    }
  }

  async function handleDeleteSelected() {
    if (!selectedRange) return;
    const toDelete = events.filter(e => e.date >= selectedRange.start && e.date < selectedRange.end);
    if (toDelete.length === 0) {
      toast.error('No events found in selected range');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${toDelete.length} event(s)?`)) return;

    for (const e of toDelete) {
      await deleteEvent(e.id);
    }
    toast.success(`Deleted ${toDelete.length} event(s)`);
    setSelectedRange(null);
    calendarRef.current?.getApi().unselect();
    loadEvents();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          {/* Mobile view switcher */}
          {isMobile && (
            <div className="flex rounded-xl border border-border overflow-hidden text-xs">
              {(['month', 'week', 'day'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setMobileView(v)}
                  className={`px-2.5 py-1.5 capitalize transition-colors ${
                    mobileView === v
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {selectedRange && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <Trash2 size={14} />
              Delete Events
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import</span>
          </button>
          {!isMobile && (
            <button
              onClick={() => setModal({ open: true, mode: 'create', defaultDate: selectedRange ? selectedRange.start : new Date().toISOString().slice(0, 10) })}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={14} />
              Add Event
            </button>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={loadEvents}
        />
      )}

      {/* Mobile custom month view */}
      {isMobile && mobileView === 'month' && (
        <div className="flex-1 overflow-hidden">
          <MobileMonthView
            events={events}
            firstDay={firstDay}
            onAddEvent={(date) => setModal({ open: true, mode: 'create', defaultDate: date })}
            onEventClick={(ev) => setModal({ open: true, mode: 'edit', event: ev })}
          />
        </div>
      )}

      {/* FullCalendar: desktop always, mobile only for week/day */}
      {(!isMobile || mobileView !== 'month') && (
        <div className="flex-1 overflow-hidden px-4 py-4">
          <div className="h-full [&_.fc]:h-full calendar-wrap">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={isMobile ? (mobileView === 'week' ? 'timeGridWeek' : 'timeGridDay') : 'dayGridMonth'}
              key={isMobile ? mobileView : 'desktop'}
              headerToolbar={isMobile ? {
                left: 'prev,next today',
                center: 'title',
                right: '',
              } : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              events={toFCEvents(events)}
              editable={true}
              selectable={true}
              eventDrop={handleEventDrop}
              select={handleSelect}
              unselect={handleUnselect}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="100%"
              firstDay={firstDay}
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
              dayMaxEvents={3}
              views={{
                dayGridMonth: {
                  displayEventTime: false,
                  eventDisplay: 'block',
                  dayMaxEvents: 2,
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Event Modal */}
      {modal.open && (
        <EventModal
          mode={modal.mode}
          event={modal.event}
          defaultDate={modal.defaultDate}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal({ open: false, mode: 'create' })}
        />
      )}
    </div>
  );
}

function EventModal({
  mode, event, defaultDate, onSave, onDelete, onClose
}: {
  mode: 'create' | 'edit';
  event?: CalendarEvent;
  defaultDate?: string;
  onSave: (data: Partial<CalendarEvent>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [date, setDate] = useState(event?.date || defaultDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [endTime, setEndTime] = useState(event?.endTime || '');
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [color, setColor] = useState(event?.color || EVENT_COLORS[0]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title, description, location, date, startTime: allDay ? undefined : startTime, endTime: allDay ? undefined : endTime, allDay, color });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">{mode === 'create' ? 'New Event' : 'Edit Event'}</h2>
          <div className="flex items-center gap-1">
            {mode === 'edit' && (
              <button onClick={onDelete} className="btn-ghost text-destructive p-2">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-2">
              <X size={14} />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
            className="input-base w-full"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="input-base w-full"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="input-base w-full resize-none"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="input-base w-full"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4 accent-primary" />
              All day
            </label>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-base w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-base w-full" />
              </div>
            </div>
          )}
          {/* Color picker */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, outline: color === c ? `2px solid white` : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost border border-border">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">{mode === 'create' ? 'Create' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
