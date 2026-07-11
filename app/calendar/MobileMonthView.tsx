'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import type { CalendarEvent } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface MobileMonthViewProps {
  events: CalendarEvent[];
  firstDay: 0 | 1; // 0 = Sun, 1 = Mon
  onAddEvent: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDisplayTime(t?: string) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function MobileMonthView({ events, firstDay, onAddEvent, onEventClick }: MobileMonthViewProps) {
  const today = localToday();
  const todayDate = new Date();
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Build calendar grid
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Offset so the first column is firstDay (0=Sun or 1=Mon)
  let startOffset = firstOfMonth.getDay(); // 0=Sun
  if (firstDay === 1) {
    // Shift: Mon=0, Tue=1, ... Sun=6
    startOffset = (startOffset + 6) % 7;
  }

  const dayHeaders = firstDay === 1
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // All cells: null = empty, number = day
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function eventsOnDay(day: number) {
    return events.filter(e => e.date === dateStr(day));
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const selectedEvents = events
    .filter(e => e.date === selectedDate)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : null;
  const selectedLabel = selectedDateObj
    ? selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <span className="text-base font-semibold text-foreground">
          {formatMonthYear(year, month)}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ChevronRight size={18} className="text-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {dayHeaders.map((h, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-3 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = dateStr(day);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const evs = eventsOnDay(day);
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(ds)}
              className="flex flex-col items-center py-0.5 gap-0.5"
            >
              <span
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all',
                  isSelected && 'bg-primary text-primary-foreground font-bold',
                  isToday && !isSelected && 'border-2 border-primary text-primary font-bold',
                  !isSelected && !isToday && 'text-foreground hover:bg-secondary'
                )}
              >
                {day}
              </span>
              {/* Event dots (up to 3) */}
              <div className="flex gap-0.5 h-1.5">
                {evs.slice(0, 3).map((e, ei) => (
                  <span
                    key={ei}
                    className="w-1 h-1 rounded-full"
                    style={{ background: e.color || 'hsl(var(--primary))' }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border mx-4 mt-3 mb-0" />

      {/* Selected day event list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedLabel}
          </p>
          <button
            onClick={() => onAddEvent(selectedDate)}
            className="btn-primary flex items-center gap-1 text-xs px-3 py-1.5"
          >
            <Plus size={12} />
            Add
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No events on this day</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedEvents.map(ev => (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="flex items-center gap-3 w-full text-left p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              >
                {/* Color bar */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: ev.color || 'hsl(var(--primary))' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                  {ev.startTime && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {formatDisplayTime(ev.startTime)}
                      {ev.endTime && ` - ${formatDisplayTime(ev.endTime)}`}
                    </p>
                  )}
                  {ev.location && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.location}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
