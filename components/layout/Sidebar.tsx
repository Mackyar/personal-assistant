'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  MessageSquare, Calendar, FileText, LayoutDashboard,
  Settings, Plus, Trash2, ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConversations, createConversation, deleteConversation } from '@/lib/db/conversations';
import type { Conversation } from '@/lib/db/schema';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/notes', icon: FileText, label: 'Notes' },
  { href: '/reminders', icon: ListTodo, label: 'Reminders' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
    // Poll for updates
    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadConversations() {
    const convs = await getConversations();
    setConversations(convs);
  }

  async function handleNewChat() {
    const conv = await createConversation();
    router.push(`/chat/${conv.id}`);
  }

  async function handleDeleteConversation(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    await deleteConversation(id);
    loadConversations();
    if (pathname.includes(id)) router.push('/chat');
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="sidebar hidden md:flex flex-col bg-card border-r border-border h-screen overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.png" className="w-8 h-8 object-cover rounded-lg flex-shrink-0" alt="Yay Schedule Logo" />
          <div>
            <h1 className="font-semibold text-sm text-foreground">Yay Schedule</h1>
            <p className="text-xs text-muted-foreground">Personal Schedule</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 py-3 border-b border-border space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn('nav-item', isActive && 'active')}>
              <Icon size={16} className={cn('flex-shrink-0', isActive ? 'text-primary' : '')} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Chat History */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Chats</span>
          <button onClick={handleNewChat} className="btn-ghost p-1.5 rounded-lg" title="New Chat">
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="mb-2">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No chats yet</p>
          ) : (
            filtered.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className={cn(
                    'group flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all',
                    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <MessageSquare size={12} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-3 py-3 border-t border-border">
        <Link href="/settings" className={cn('nav-item', pathname === '/settings' && 'active')}>
          <Settings size={16} className={cn(pathname === '/settings' ? 'text-primary' : '')} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
