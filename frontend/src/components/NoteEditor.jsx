import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Undo2, Redo2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/utils';

// ─── Markdown ke HTML sederhana ─────────────────────────────────────────────
// Konversi content yang masih Markdown mentah jadi HTML agar natural di editor
function markdownToHtml(text) {
  if (!text) return '';
  // Jika sudah HTML (dimulai dengan <), kembalikan apa adanya
  if (text.trimStart().startsWith('<')) return text;

  let html = text
    // Escape HTML entities dulu
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic combo
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Bullet list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Checkbox unchecked
    .replace(/^- \[ \] (.+)$/gm, '<li data-type="taskItem" data-checked="false">$1</li>')
    // Checkbox checked
    .replace(/^- \[x\] (.+)$/gm, '<li data-type="taskItem" data-checked="true">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Bungkus baris li berurutan dengan ul
  html = html.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

  // Bungkus baris biasa (bukan tag) jadi <p>
  const lines = html.split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isBlock = /^<(h[1-6]|ul|ol|li|blockquote|hr|pre|div)/.test(trimmed);
    if (isBlock) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.join('');
}

// ─── Palette warna ───────────────────────────────────────────────────────────
const FONT_COLORS = [
  { color: '#FAFAFA', label: 'Putih'   },
  { color: '#F87171', label: 'Merah'   },
  { color: '#FB923C', label: 'Oranye'  },
  { color: '#FBBF24', label: 'Kuning'  },
  { color: '#34D399', label: 'Hijau'   },
  { color: '#38BDF8', label: 'Biru Muda' },
  { color: '#818CF8', label: 'Ungu'    },
  { color: '#F472B6', label: 'Pink'    },
  { color: '#A78BFA', label: 'Lavender'},
  { color: '#6EE7B7', label: 'Mint'    },
  { color: '#FDE68A', label: 'Krim'    },
  { color: '#FCA5A5', label: 'Salmon'  },
  { color: '#93C5FD', label: 'Biru'    },
  { color: '#6B7280', label: 'Abu'     },
  { color: '#10B981', label: 'Emerald' },
];

// ─── Tombol toolbar ──────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, disabled, title, children, size = 'md' }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded transition-colors select-none flex items-center justify-center',
        size === 'sm' ? 'p-1' : 'p-1.5',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-text-muted hover:text-text hover:bg-white/5',
        disabled && 'opacity-25 cursor-not-allowed pointer-events-none'
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border/60 mx-0.5 shrink-0" />;
}

// ─── Color Picker dropdown ───────────────────────────────────────────────────
function ColorPicker({ editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const currentColor = editor.getAttributes('textStyle').color;

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen(v => !v); }}
        title="Warna Teks"
        className={cn(
          'p-1.5 rounded transition-colors select-none flex flex-col items-center gap-0.5',
          open ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text hover:bg-white/5'
        )}
      >
        <span className="text-[11px] font-bold leading-none" style={{ color: currentColor || '#FAFAFA' }}>A</span>
        <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: currentColor || '#FAFAFA' }} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 p-2.5 bg-[#18181B] border border-border rounded-xl shadow-2xl z-50 w-[148px]">
          <p className="text-[10px] text-text-muted mb-2 select-none">Warna Teks</p>
          <div className="grid grid-cols-5 gap-1.5">
            {FONT_COLORS.map(({ color, label }) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setColor(color).run();
                  setOpen(false);
                }}
                title={label}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                  currentColor === color ? 'border-primary scale-110' : 'border-transparent hover:border-white/30'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            {/* Reset */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetColor().run();
                setOpen(false);
              }}
              title="Reset warna"
              className="w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center text-[10px] text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Komponen utama NoteEditor ───────────────────────────────────────────────
export default function NoteEditor({ content, onSave, noteId }) {
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  // Convert markdown → html sekali saat pertama, lalu pakai as-is untuk HTML
  const initialHtml = markdownToHtml(content || '');

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
    content: initialHtml,
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

  // Ganti konten saat pindah note
  useEffect(() => {
    if (!editor) return;
    const html = markdownToHtml(content || '');
    editor.commands.setContent(html, false);
    lastSavedRef.current = html;
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  if (!editor) return null;

  const ia = (name, attrs) => editor.isActive(name, attrs);

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar utama ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-sidebar sticky top-0 z-10">

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

        {/* Warna font */}
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

      </div>

      {/* ── Bubble Menu — muncul saat teks diblok ───────────────────────── */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 150, placement: 'top' }}
        className="flex items-center gap-0.5 px-1.5 py-1 bg-[#18181B] border border-border rounded-xl shadow-2xl"
      >
        <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title="Bold">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title="Italic">
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title="Underline">
          <UnderlineIcon size={13} />
        </ToolBtn>
        <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title="Coret">
          <Strikethrough size={13} />
        </ToolBtn>
        <div className="w-px h-3.5 bg-border/60 mx-0.5" />
        <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title="Rata Kiri">
          <AlignLeft size={13} />
        </ToolBtn>
        <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title="Rata Tengah">
          <AlignCenter size={13} />
        </ToolBtn>
        <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title="Rata Kanan">
          <AlignRight size={13} />
        </ToolBtn>
        <div className="w-px h-3.5 bg-border/60 mx-0.5" />
        {/* Warna cepat di bubble */}
        {['#F87171','#FBBF24','#34D399','#818CF8','#FAFAFA'].map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); }}
            className="w-4 h-4 rounded-full border border-transparent hover:border-white/40 transition-all hover:scale-110"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
          className="w-4 h-4 rounded-full border border-dashed border-border/80 flex items-center justify-center text-[8px] text-text-muted hover:border-white/40 transition-colors"
          title="Reset warna"
        >✕</button>
      </BubbleMenu>

      {/* ── Area editor ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <EditorContent editor={editor} />
      </div>

    </div>
  );
}
