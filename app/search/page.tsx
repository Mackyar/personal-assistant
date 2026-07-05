'use client';

import { useState } from 'react';
import { Search, FileText, Calendar, Clock, MessageSquare, Filter } from 'lucide-react';
import { searchNotesByText } from '@/lib/db/notes';
import { searchEventsByText } from '@/lib/db/events';
import { searchConversations } from '@/lib/db/conversations';
import { db } from '@/lib/db/schema';
import { formatDate, formatRelativeDate, cn } from '@/lib/utils';
import Link from 'next/link';

type SearchResult = {
  id: string;
  type: 'note' | 'event' | 'reminder' | 'message';
  title: string;
  snippet?: string;
  date?: string;
  href: string;
  timestamp?: number;
};

type FilterType = 'all' | 'note' | 'event' | 'reminder' | 'message';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    const [notes, events, messages, reminders] = await Promise.all([
      filter === 'all' || filter === 'note' ? searchNotesByText(query) : Promise.resolve([]),
      filter === 'all' || filter === 'event' ? searchEventsByText(query) : Promise.resolve([]),
      filter === 'all' || filter === 'message' ? searchConversations(query) : Promise.resolve([]),
      filter === 'all' || filter === 'reminder'
        ? db.reminders.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())).toArray()
        : Promise.resolve([]),
    ]);

    const allResults: SearchResult[] = [
      ...notes.map((n) => ({
        id: n.id, type: 'note' as const, title: n.title,
        snippet: n.contentText.slice(0, 150),
        href: `/notes/${n.id}`, timestamp: n.updatedAt,
      })),
      ...events.map((e) => ({
        id: e.id, type: 'event' as const, title: e.title,
        snippet: e.description, date: e.date,
        href: `/calendar`, timestamp: e.updatedAt,
      })),
      ...reminders.map((r) => ({
        id: r.id, type: 'reminder' as const, title: r.title,
        snippet: r.description, date: r.dueDate,
        href: `/chat`, timestamp: r.updatedAt,
      })),
      ...messages.slice(0, 10).map((m) => ({
        id: m.id, type: 'message' as const, title: `Chat: ${m.content.slice(0, 60)}`,
        snippet: m.content.slice(0, 150),
        href: `/chat/${m.conversationId}`, timestamp: m.createdAt,
      })),
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    setResults(allResults);
    setLoading(false);
  }

  const TYPE_ICONS = {
    note: <FileText size={13} className="text-green-400" />,
    event: <Calendar size={13} className="text-blue-400" />,
    reminder: <Clock size={13} className="text-amber-400" />,
    message: <MessageSquare size={13} className="text-primary" />,
  };

  const TYPE_LABELS: Record<FilterType, string> = { all: 'All', note: 'Notes', event: 'Events', reminder: 'Reminders', message: 'Chats' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-3 border-b border-border bg-card/50">
        <h1 className="text-lg font-semibold">Search</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Search form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, events, reminders, chats..."
                className="w-full pl-11 pr-4 py-3.5 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary text-xs px-3 py-1.5">
                Search
              </button>
            </div>
          </form>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            <Filter size={13} className="text-muted-foreground flex-shrink-0" />
            {(['all', 'note', 'event', 'reminder', 'message'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {TYPE_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
            </div>
          ) : searched ? (
            results.length === 0 ? (
              <div className="text-center py-12">
                <Search size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</p>
                {results.map((r) => (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.href}
                    className="block bg-card border border-border hover:border-primary/30 rounded-xl p-4 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{TYPE_ICONS[r.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{r.title}</h3>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {r.date ? formatDate(r.date) : r.timestamp ? formatRelativeDate(r.timestamp) : ''}
                          </span>
                        </div>
                        {r.snippet && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{r.snippet}</p>
                        )}
                        <span className="text-[10px] text-muted-foreground capitalize mt-1 inline-block opacity-60">{r.type}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Search size={40} className="text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">Search across your notes, events, reminders, and chats</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
