'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, FileText, Clock, ChevronRight, Plus, Search } from 'lucide-react';
import { getTodayEvents, getUpcomingEvents, getUpcomingReminders } from '@/lib/db/events';
import { getNotes } from '@/lib/db/notes';
import { getSettings } from '@/lib/db/settings';
import { getAIProvider, hasRequiredKey } from '@/lib/ai/client';
import { formatDate, formatTime, formatRelativeDate, cn } from '@/lib/utils';
import type { CalendarEvent, Note, Reminder } from '@/lib/db/schema';

export default function DashboardPage() {
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [te, ue, notes, rems] = await Promise.all([
      getTodayEvents(),
      getUpcomingEvents(7),
      getNotes({ limit: 5, isArchived: false }),
      getUpcomingReminders(7),
    ]);
    setTodayEvents(te.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    setUpcomingEvents(ue.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    }));
    setRecentNotes(notes);
    setReminders(rems);
    setLoaded(true);
    generateSummary(te, rems);
  }

  async function generateSummary(events: CalendarEvent[], rems: Reminder[]) {
    const settings = await getSettings();
    if (!hasRequiredKey(settings)) return;

    // Check cache first to avoid quota drain
    const todayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `ai_summary_${todayKey}_${settings.activeProvider}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAiSummary(cached);
      return;
    }

    setSummaryLoading(true);
    try {
      const provider = await getAIProvider(settings);
      const context = [
        `Today is ${new Date().toDateString()}.`,
        events.length > 0 ? `Today's events: ${events.map((e) => `${e.title}${e.startTime ? ' at ' + formatTime(e.startTime) : ''}`).join(', ')}` : 'No events today.',
        rems.length > 0 ? `Upcoming reminders: ${rems.map((r) => `${r.title} (${r.dueDate})`).join(', ')}` : 'No pending reminders.',
      ].join('\n');
      const summary = await provider.chat([
        { role: 'system', content: 'You are a personal assistant. Write a brief (2-3 sentence) friendly daily summary based on the user\'s schedule. Be warm and motivating.' },
        { role: 'user', content: context },
      ]);
      setAiSummary(summary);
      localStorage.setItem(cacheKey, summary);
    } catch {}
    setSummaryLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Good {getGreeting()}, there!</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{dateStr} - {timeStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/search" className="btn-ghost border border-border flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
              </Link>
              <Link href="/chat" className="btn-primary flex items-center gap-2 text-sm">
                <Calendar size={14} />
                Ask AI
              </Link>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        <div className="glass rounded-2xl p-4 border border-primary/20 fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' }}>
              <Calendar size={12} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI Daily Briefing</span>
          </div>
          {summaryLoading ? (
            <div className="flex items-center gap-1.5">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          ) : aiSummary ? (
            <p className="text-sm text-foreground/90 leading-relaxed">{aiSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add your OpenAI key in{' '}
              <Link href="/settings" className="text-primary underline">Settings</Link>
              {' '}to get personalized daily briefings.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Today's Events */}
          <DashboardCard
            icon={<Calendar size={15} className="text-primary" />}
            title="Today's Schedule"
            count={todayEvents.length}
            href="/calendar"
            addHref="/calendar"
          >
            {todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No events today, enjoy your free day! 🎉</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.color }} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.title}</p>
                      {e.startTime && <p className="text-xs text-muted-foreground">{formatTime(e.startTime)}{e.endTime ? ` - ${formatTime(e.endTime)}` : ''}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Reminders */}
          <DashboardCard
            icon={<Clock size={15} className="text-amber-400" />}
            title="Upcoming Reminders"
            count={reminders.length}
            href="/chat"
          >
            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">All clear! No pending reminders.</p>
            ) : (
              <div className="space-y-2">
                {reminders.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{r.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(r.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Upcoming Events */}
          <DashboardCard
            icon={<Calendar size={15} className="text-blue-400" />}
            title="This Week"
            count={upcomingEvents.length}
            href="/calendar"
          >
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nothing scheduled this week.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{e.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(e.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Recent Notes */}
          <DashboardCard
            icon={<FileText size={15} className="text-green-400" />}
            title="Recent Notes"
            count={recentNotes.length}
            href="/notes"
            addHref="/notes"
          >
            {recentNotes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No notes yet. Start capturing your thoughts!</p>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((n) => (
                  <Link key={n.id} href={`/notes/${n.id}`} className="flex items-center gap-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground group-hover:text-primary truncate transition-colors">{n.title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatRelativeDate(n.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Quick actions */}
        <div className="fade-in">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'New Note', icon: FileText, href: '/notes', color: 'text-green-400', bg: 'bg-green-400/10' },
              { label: 'Add Event', icon: Calendar, href: '/calendar', color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { label: 'Ask AI', icon: Calendar, href: '/chat', color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Search', icon: Search, href: '/search', color: 'text-amber-400', bg: 'bg-amber-400/10' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-secondary transition-all"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', a.bg)}>
                    <Icon size={16} className={a.color} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  icon, title, count, href, addHref, children
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  addHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">{count}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {addHref && (
            <Link href={addHref} className="btn-ghost p-1.5">
              <Plus size={13} />
            </Link>
          )}
          <Link href={href} className="btn-ghost p-1.5">
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
