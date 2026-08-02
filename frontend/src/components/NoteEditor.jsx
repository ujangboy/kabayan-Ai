/**
 * NoteEditor — Dual-mode note viewer + rich text editor.
 *
 * VIEW MODE  : MathMarkdown (identik dengan Chat AI) — render bersih, support LaTeX
 * EDIT MODE  : Tiptap WYSIWYG — toolbar formatting lengkap
 *
 * Konten di DB disimpan sebagai Markdown (legacy) atau HTML (hasil edit Tiptap).
 * Deteksi otomatis: jika konten dimulai "<" → sudah HTML, langsung ke Tiptap.
 * Jika masih Markdown → tampilkan via MathMarkdown, konversi ke HTML saat masuk edit mode.
 */
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Undo2, Redo2,
  Edit3, Eye,
} from 'lucide-react';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';

// ─── Konfigurasi marked ───────────────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

/**
 * Konversi konten → HTML untuk Tiptap.
 * Jika sudah HTML, langsung pakai.
 * Jika Markdown, convert via marked.
 */
function toHtml(content) {
  if (!content) return '';
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<')) return content; // sudah HTML
  // Markdown → HTML via marked (sync, string)
  const result = marked.parse(content);
  return typeof result === 'string' ? result : content;
}

// ─── Palette warna ───────────────────────────────────────────────────────────
const COLORS = [
  '#FAFAFA', '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#38BDF8', '#818CF8', '#F472B6', '#A78BFA', '#6EE7B7',
  '#FDE68A', '#FCA5A5', '#C4B5FD', '#93C5FD', '#10B981',
];

// ─── Tombol toolbar ──────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, disabled, title, children, sm }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded transition-colors select-none flex items-center justify-center shrink-0',
        sm ? 'p-1' : 'p-1.5',
        active ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text hover:bg-white/5',
        disabled && 'opacity-25 cursor-not-allowed pointer-events-none'
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />;
}

// ─── Color Picker (click-based, tidak pakai hover CSS) ───────────────────────
function ColorPicker({ editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentColor = editor?.getAttributes('textStyle').color;

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen(v => !v); }}
        title="Warna Teks"
        className={cn(
          'p-1.5 rounded transition-colors select-none flex flex-col items-center gap-0.5 min-w-[26px]',
          open ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text hover:bg-white/5'
        )}
      >
        <span className="text-[12px] font-bold leading-none" style={{ color: currentColor || '#FAFAFA' }}>A</span>
        <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: currentColor || '#FAFAFA' }} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 p-2.5 bg-[#18181B] border border-border rounded-xl shadow-2xl z-50">
          <p className="text-[10px] text-text-muted mb-2 select-none font-medium">Warna Teks</p>
          <div className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setColor(c).run();
                  setOpen(false);
                }}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                  currentColor === c ? 'border-primary scale-110' : 'border-transparent hover:border-white/30'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetColor().run();
                setOpen(false);
              }}
              className="w-6 h-6 rounded-full border-2 border-dashed border-border/80 flex items-center justify-center text-[10px] text-text-muted hover:border-primary hover:text-primary transition-colors"
              title="Reset warna"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toolbar lengkap ─────────────────────────────────────────────────────────
function Toolbar({ editor, mode, onToggleMode }) {
  if (!editor) return null;
  const ia = (n, a) => editor.isActive(n, a);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-sidebar sticky top-0 z-10">

      {/* Toggle view/edit */}
      <button
        type="button"
        onClick={onToggleMode}
        title={mode === 'edit' ? 'Mode Baca' : 'Mode Edit'}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors shrink-0 mr-1',
          mode === 'edit'
            ? 'bg-primary/15 text-primary border border-primary/30'
            : 'bg-card text-text-secondary border border-border hover:border-primary/40 hover:text-primary'
        )}
      >
        {mode === 'edit' ? <><Eye size={12} /> Pratinjau</> : <><Edit3 size={12} /> Edit</>}
      </button>

      {mode === 'edit' && (
        <>
          <Sep />

          {/* Undo / Redo */}
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
            <Undo2 size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
            <Redo2 size={14} />
          </ToolBtn>

          <Sep />

          {/* Format teks */}
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title="Bold (Ctrl+B)">
            <Bold size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title="Italic (Ctrl+I)">
            <Italic size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title="Underline (Ctrl+U)">
            <UnderlineIcon size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title="Coret">
            <Strikethrough size={14} />
          </ToolBtn>

          <Sep />

          {/* Warna */}
          <ColorPicker editor={editor} />

          <Sep />

          {/* Alignment */}
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title="Rata Kiri">
            <AlignLeft size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title="Rata Tengah">
            <AlignCenter size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title="Rata Kanan">
            <AlignRight size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={ia({ textAlign: 'justify' })} title="Rata Kiri-Kanan">
            <AlignJustify size={14} />
          </ToolBtn>

          <Sep />

          {/* Lists */}
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title="Daftar Titik">
            <List size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title="Daftar Bernomor">
            <ListOrdered size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title="To-Do List">
            <ListChecks size={14} />
          </ToolBtn>
        </>
      )}
    </div>
  );
}

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function NoteEditor({ content, onSave, noteId }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'note-editor-content focus:outline-none min-h-[400px] pb-20' },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const html = editor.getHTML();
        if (html !== lastSavedRef.current) {
          lastSavedRef.current = html;
          onSave?.(html);
        }
      }, 1500);
    },
  });

  // Saat note berganti atau masuk edit mode: load konten ke editor
  useEffect(() => {
    if (!editor) return;
    if (mode === 'edit') {
      const html = toHtml(content || '');
      editor.commands.setContent(html, false);
      lastSavedRef.current = html;
      // Fokus ke editor
      setTimeout(() => editor.commands.focus('end'), 50);
    }
  }, [noteId, mode, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset ke view mode saat pindah note
  useEffect(() => {
    setMode('view');
  }, [noteId]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const handleToggleMode = () => setMode(m => m === 'view' ? 'edit' : 'view');

  const ia = (n, a) => editor?.isActive(n, a);

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <Toolbar editor={editor} mode={mode} onToggleMode={handleToggleMode} />

      {/* Bubble menu (hanya di edit mode) */}
      {editor && mode === 'edit' && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, placement: 'top' }}
          className="flex items-center gap-0.5 px-1.5 py-1 bg-[#18181B] border border-border/80 rounded-xl shadow-2xl"
        >
          <ToolBtn sm onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title="Bold">
            <Bold size={13} />
          </ToolBtn>
          <ToolBtn sm onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title="Italic">
            <Italic size={13} />
          </ToolBtn>
          <ToolBtn sm onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title="Underline">
            <UnderlineIcon size={13} />
          </ToolBtn>
          <ToolBtn sm onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title="Coret">
            <Strikethrough size={13} />
          </ToolBtn>
          <div className="w-px h-3.5 bg-border/50 mx-0.5" />
          <ToolBtn sm onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title="Rata Kiri">
            <AlignLeft size={13} />
          </ToolBtn>
          <ToolBtn sm onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title="Tengah">
            <AlignCenter size={13} />
          </ToolBtn>
          <ToolBtn sm onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title="Rata Kanan">
            <AlignRight size={13} />
          </ToolBtn>
          <div className="w-px h-3.5 bg-border/50 mx-0.5" />
          {/* Warna cepat */}
          {['#F87171', '#FBBF24', '#34D399', '#818CF8', '#38BDF8'].map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); }}
              className="w-4 h-4 rounded-full border border-transparent hover:border-white/50 transition-all hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
            className="w-4 h-4 rounded-full border border-dashed border-border/60 flex items-center justify-center text-[8px] text-text-muted hover:border-white/40 transition-colors"
          >✕</button>
        </BubbleMenu>
      )}

      {/* Konten */}
      <div className="flex-1 overflow-y-auto">

        {/* VIEW MODE: MathMarkdown — identik dengan Chat AI */}
        {mode === 'view' && (
          <div
            className="max-w-3xl mx-auto px-10 py-8 cursor-text"
            onDoubleClick={handleToggleMode}
            title="Klik dua kali untuk mengedit"
          >
            <MathMarkdown>{content || ''}</MathMarkdown>
            <p className="text-[10px] text-text-muted mt-8 text-center select-none opacity-50">
              Klik dua kali atau tombol Edit untuk mengedit
            </p>
          </div>
        )}

        {/* EDIT MODE: Tiptap */}
        {mode === 'edit' && (
          <div className="max-w-3xl mx-auto px-10 py-8">
            <EditorContent editor={editor} />
          </div>
        )}

      </div>
    </div>
  );
}
