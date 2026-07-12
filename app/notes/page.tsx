'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Pin, Archive, Tag, Folder, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { getNotes, createNote, deleteNote } from '@/lib/db/notes';
import { db } from '@/lib/db/schema';
import { formatRelativeDate, cn, truncate } from '@/lib/utils';
import type { Note } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadNotes(); }, [activeFolder, showArchived]);

  async function loadNotes() {
    const opts: Parameters<typeof getNotes>[0] = {};
    if (activeFolder !== 'all' && activeFolder !== 'pinned') opts.folder = activeFolder;
    if (activeFolder === 'pinned') opts.isPinned = true;
    opts.isArchived = showArchived;
    const n = await getNotes(opts);
    setNotes(n);
    // Collect unique folders
    const all = await getNotes();
    const fs = [...new Set(all.map((n) => n.folder).filter(Boolean))];
    setFolders(fs);
  }

  async function handleNewNote() {
    const note = await createNote({
      title: 'Untitled Note',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      contentText: '',
      folder: activeFolder !== 'all' && activeFolder !== 'pinned' ? activeFolder : 'root',
    });
    router.push(`/notes/${note.id}`);
  }

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.contentText.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter((n) => n.isPinned);
  const regular = filtered.filter((n) => !n.isPinned);

  return (
    <div className="flex h-full">
      {/* Folders sidebar */}
      <div className="w-48 hidden sm:flex flex-col bg-card border-r border-border p-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Folders</p>
        {[
          { id: 'all', label: 'All Notes', icon: FileText },
          { id: 'pinned', label: 'Pinned', icon: Pin },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFolder(f.id)}
            className={cn('flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all', activeFolder === f.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
          >
            <f.icon size={13} />
            {f.label}
          </button>
        ))}
        {folders.length > 0 && <div className="border-t border-border my-2" />}
        {folders.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFolder(f)}
            className={cn('flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all', activeFolder === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
          >
            <Folder size={13} />
            {f}
          </button>
        ))}
        <div className="border-t border-border my-2" />
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn('flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all', showArchived ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
        >
          <Archive size={13} />
          Archived
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <h1 className="text-lg font-semibold">Notes</h1>
          <button onClick={handleNewNote} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} />
            New Note
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full !pl-9 input-base text-xs"
            />
          </div>
        </div>

        {/* Notes grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {pinned.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pin size={11} />Pinned
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pinned.map((n) => <NoteCard key={n.id} note={n} onRefresh={loadNotes} />)}
              </div>
            </div>
          )}
          {regular.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {regular.map((n) => <NoteCard key={n.id} note={n} onRefresh={loadNotes} />)}
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText size={32} className="text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No notes yet</p>
              <button onClick={handleNewNote} className="mt-3 btn-primary text-xs">Create your first note</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onRefresh }: { note: Note; onRefresh: () => void }) {
  async function togglePin(e: React.MouseEvent) {
    e.preventDefault();
    await db.notes.update(note.id, { isPinned: !note.isPinned, updatedAt: Date.now() });
    onRefresh();
  }

  async function toggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    await db.notes.update(note.id, { isArchived: !note.isArchived, updatedAt: Date.now() });
    onRefresh();
    toast.success(note.isArchived ? 'Note unarchived' : 'Note archived');
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;
    await deleteNote(note.id);
    onRefresh();
    toast.success('Note deleted');
  }

  return (
    <Link
      href={`/notes/${note.id}`}
      className="group block bg-card border border-border hover:border-primary/30 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{note.title}</h3>
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={togglePin} className={cn('p-1 rounded hover:bg-secondary transition-all', note.isPinned && 'text-amber-400')}>
            <Pin size={11} />
          </button>
          <button onClick={toggleArchive} className="p-1 rounded hover:bg-secondary transition-all text-muted-foreground">
            <Archive size={11} />
          </button>
          <button onClick={handleDelete} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all text-muted-foreground">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {note.contentText && (
        <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-3">{truncate(note.contentText, 120)}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{formatRelativeDate(note.updatedAt)}</span>
      </div>
    </Link>
  );
}
