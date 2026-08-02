import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Undo2, Redo2,
  Palette,
} from 'lucide-react';
import { cn } from '@/utils';

// ─── Warna font palette (sesuai referensi foto) ───────────────────────────
const FONT_COLORS = [
  '#FAFAFA', '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#38BDF8', '#818CF8', '#F472B6', '#A78BFA', '#6EE7B7',
  '#FDE68A', '#FCA5A5', '#C4B5FD', '#93C5FD', '#6B7280',
];

// ─── Tombol toolbar tunggal ───────────────────────────────────────────────
function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors select-none',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-text-muted hover:text-text hover:bg-card',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

// ─── Divider tipis antar group ────────────────────────────────────────────
function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

// ─── Komponen utama ───────────────────────────────────────────────────────
export default function NoteEditor({ content, onSave, noteId }) {
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(content);
  const colorPickerRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // heading h1-h3 aktif, code block aktif
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'note-editor-content focus:outline-none min-h-[300px]',
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced auto-save setiap 1.5 detik setelah berhenti mengetik
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

  // Update editor saat note berganti (pindah ke catatan lain)
  useEffect(() => {
    if (!editor) return;
    const html = content || '';
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, false);
      lastSavedRef.current = html;
    }
  }, [noteId, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer saat unmount
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  if (!editor) return null;

  const isActive = (name, attrs) => editor.isActive(name, attrs);

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-border bg-sidebar sticky top-0 z-10">

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Bold / Italic / Underline / Strikethrough */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Warna font */}
        <div className="relative group/color">
          <ToolbarButton
            onClick={() => {}}
            title="Warna Teks"
          >
            <div className="flex flex-col items-center gap-0.5">
              <Palette size={14} />
              <div
                className="w-4 h-1 rounded-full"
                style={{ backgroundColor: editor.getAttributes('textStyle').color || '#FAFAFA' }}
              />
            </div>
          </ToolbarButton>
          {/* Dropdown palette — muncul saat hover */}
          <div className="absolute left-0 top-full mt-1 p-2 bg-card border border-border rounded-xl shadow-xl z-20 hidden group-hover/color:block">
            <div className="grid grid-cols-5 gap-1.5 w-[120px]">
              {FONT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(c).run();
                  }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                    editor.getAttributes('textStyle').color === c
                      ? 'border-primary scale-110'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {/* Reset warna */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetColor().run();
                }}
                className="w-5 h-5 rounded-full border-2 border-dashed border-border flex items-center justify-center text-[9px] text-text-muted hover:border-primary transition-colors"
                title="Reset warna"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={isActive({ textAlign: 'left' })}
          title="Rata Kiri"
        >
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={isActive({ textAlign: 'center' })}
          title="Rata Tengah"
        >
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={isActive({ textAlign: 'right' })}
          title="Rata Kanan"
        >
          <AlignRight size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={isActive({ textAlign: 'justify' })}
          title="Rata Kiri-Kanan"
        >
          <AlignJustify size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={isActive('bulletList')}
          title="Daftar Titik"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={isActive('orderedList')}
          title="Daftar Bernomor"
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={isActive('taskList')}
          title="Daftar Periksa (To-Do)"
        >
          <ListChecks size={15} />
        </ToolbarButton>

      </div>

      {/* ── Editor area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
