'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Trash2, ChevronRight } from 'lucide-react';
import { getConversations, createConversation, deleteConversation } from '@/lib/db/conversations';
import type { Conversation } from '@/lib/db/schema';
import toast from 'react-hot-toast';

export default function ChatsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    const convs = await getConversations();
    setConversations(convs);
    setLoaded(true);
  }

  async function handleNew() {
    const conv = await createConversation();
    router.push(`/chat/${conv.id}`);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await deleteConversation(id);
    toast.success('Conversation deleted');
    loadConversations();
  }

  function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <h1 className="text-lg font-semibold">Chats</h1>
        <button
          onClick={handleNew}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {!loaded ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start a chat with your AI assistant</p>
            </div>
            <button onClick={handleNew} className="btn-primary flex items-center gap-2">
              <Plus size={14} />
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} · {formatDate(conv.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
