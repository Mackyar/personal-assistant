'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code, Heading1, Heading2,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Link2, Pin, Archive, Trash2, Download, ArrowLeft,
  Tag, Check, X
} from 'lucide-react';
import { getNote, updateNote, deleteNote } from '@/lib/db/notes';
import { cn, formatRelativeDate } from '@/lib/utils';
import type { Note } from '@/lib/db/schema';
import toast from 'react-hot-toast';

// PDF export
async function exportToPDF(note: Note) {
  const { Document, Page, Text, StyleSheet, pdf, View } = await import('@react-pdf/renderer');
  const { createElement: h } = await import('react');

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    meta: { fontSize: 10, color: '#666', marginBottom: 20 },
    body: { fontSize: 12, lineHeight: 1.6 },
  });

  const doc = h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      h(View, null,
        h(Text, { style: styles.title }, note.title),
        h(Text, { style: styles.meta }, `Created: ${new Date(note.createdAt).toLocaleString()} • Tags: ${note.tags.join(', ') || 'none'}`),
        h(Text, { style: styles.body }, note.contentText)
      )
    )
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('PDF exported!');
}

// PNG export
async function exportToPNG(note: Note) {
  const html2canvas = (await import('html2canvas')).default;
  const el = document.getElementById('note-export-target');
  if (!el) return;
  const canvas = await html2canvas(el, { backgroundColor: '#0f0f1a', scale: 2 });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title}.png`;
  a.click();
  toast.success('PNG exported!');
}

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setSaved(false);
      debounceSave(editor.getJSON(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px] text-sm leading-relaxed text-foreground',
      },
    },
  });

  const debounceSave = useCallback((json: object, text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!id) return;
      setSaving(true);
      await updateNote(id, { content: JSON.stringify(json), contentText: text, updatedAt: Date.now() });
      setSaving(false);
      setSaved(true);
    }, 800);
  }, [id]);

  useEffect(() => {
    if (id) loadNote();
  }, [id]);

  async function loadNote() {
    const n = await getNote(id);
    if (!n) { router.push('/notes'); return; }
    setNote(n);
    setTitle(n.title);
    setTags(n.tags);
    if (editor && n.content) {
      try {
        editor.commands.setContent(JSON.parse(n.content));
      } catch {
        editor.commands.setContent(n.content);
      }
    }
  }

  useEffect(() => {
    if (editor && note?.content) {
      try { editor.commands.setContent(JSON.parse(note.content)); } catch {}
    }
  }, [editor, note]);

  async function handleTitleBlur() {
    if (!id || title === note?.title) return;
    await updateNote(id, { title });
    setNote((prev) => prev ? { ...prev, title } : prev);
    toast.success('Title saved');
  }

  async function handleAddTag(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        setTags(newTags);
        await updateNote(id, { tags: newTags });
      }
      setTagInput('');
    }
  }

  async function handleRemoveTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    await updateNote(id, { tags: newTags });
  }

  async function handleDelete() {
    if (!confirm('Delete this note?')) return;
    await deleteNote(id);
    router.push('/notes');
    toast.success('Note deleted');
  }

  async function handleTogglePin() {
    if (!note) return;
    const updated = await updateNote(id, { isPinned: !note.isPinned });
    setNote(updated || note);
    toast.success(note.isPinned ? 'Unpinned' : 'Pinned');
  }

  async function handleToggleArchive() {
    if (!note) return;
    const updated = await updateNote(id, { isArchived: !note.isArchived });
    setNote(updated || note);
    toast.success(note.isArchived ? 'Unarchived' : 'Archived');
  }

  if (!note) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/50 overflow-x-auto">
        <button onClick={() => router.push('/notes')} className="btn-ghost p-1.5 flex-shrink-0">
          <ArrowLeft size={15} />
        </button>
        <div className="w-px h-4 bg-border flex-shrink-0" />

        {/* Format buttons */}
        {editor && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
              <Bold size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
              <Italic size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
              <UnderlineIcon size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike">
              <Strikethrough size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
              <Code size={13} />
            </ToolbarBtn>
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">
              <Heading1 size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">
              <Heading2 size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
              <List size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
              <ListOrdered size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
              <Quote size={13} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
              <Highlighter size={13} />
            </ToolbarBtn>
          </div>
        )}

        <div className="flex-1" />

        {/* Status + actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {saving ? 'Saving...' : saved ? <span className="text-green-400 flex items-center gap-1"><Check size={11} />Saved</span> : 'Unsaved'}
          </span>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={handleTogglePin} className={cn('btn-ghost p-1.5', note.isPinned && 'text-amber-400')} title="Pin">
            <Pin size={13} />
          </button>
          <button onClick={handleToggleArchive} className="btn-ghost p-1.5" title="Archive">
            <Archive size={13} />
          </button>
          <button onClick={() => exportToPDF(note)} className="btn-ghost p-1.5" title="Export PDF">
            <Download size={13} />
          </button>
          <button onClick={handleDelete} className="btn-ghost p-1.5 text-destructive" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div id="note-export-target" className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Note title..."
            className="w-full text-3xl font-bold bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none mb-2"
          />
          <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
            <span>{formatRelativeDate(note.updatedAt)}</span>
            <span>·</span>
            <span>{note.folder}</span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <Tag size={12} className="text-muted-foreground" />
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 tag-pill">
                {tag}
                <button onClick={() => handleRemoveTag(tag)}><X size={9} /></button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag..."
              className="text-xs bg-transparent text-muted-foreground focus:outline-none placeholder:text-muted-foreground/50 w-20"
            />
          </div>

          {/* TipTap Editor */}
          <div className="tiptap-editor">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn('p-1.5 rounded transition-all', active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}
    >
      {children}
    </button>
  );
}
