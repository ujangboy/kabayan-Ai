/**
 * NoteEditor — Dual-mode note viewer + rich text editor.
 *
 * VIEW MODE  : MathMarkdown (identik dengan Chat AI) — bersih, no toolbar
 * EDIT MODE  : Tiptap WYSIWYG — toolbar + custom floating toolbar saat select
 *
 * Floating button untuk switch view/edit.
 * Custom floating toolbar (bukan BubbleMenu) untuk hindari React DOM conflict.
 * KaTeX rendering via custom MathInline/MathBlock extensions.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Undo2, Redo2,
  Edit3, Eye, Pi,
} from 'lucide-react';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { MathInline, MathBlock } from '@/extensions/math';

// ─── Konfigurasi marked ───────────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

/**
 * Convert markdown to HTML, then post-process LaTeX delimiters
 * into Tiptap-compatible math nodes (<span data-math-inline> / <div data-math-block>).
 */
async function toHtml(content) {
  if (!content) return '';

  const trimmed = content.trimStart();
  if (trimmed.startsWith('<')) return content;

  let result = marked.parse(content);
  if (typeof result !== 'string') result = await result;

  // Post-process: convert LaTeX delimiters to Tiptap math nodes
  // (marked doesn't understand LaTeX, so they remain as raw text)
  result = convertLatexToTiptapHtml(result);

  return result;
}

/**
 * Convert $...$ → <span data-math-inline data-latex="...">$...$</span>
 * Convert $$...$$ → <div data-math-block data-latex="...">$$...$$</div>
 * Skip inside <code>, <pre>, <script>, <style>, HTML attributes.
 */
function convertLatexToTiptapHtml(html) {
  // First: convert $$...$$ (block) — must be before single $
  // Match display math blocks (may span multiple lines)
  html = html.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_, latex) => {
      const escaped = latex.replace(/"/g, '&quot;');
      return `<div data-math-block data-latex="${escaped}" class="math-block-placeholder">${latex.trim()}</div>`;
    }
  );

  // Then: convert $...$ (inline)
  html = html.replace(
    /\$([^\$\n]+?)\$/g,
    (_, latex) => {
      const escaped = latex.replace(/"/g, '&quot;');
      return `<span data-math-inline data-latex="${escaped}" class="math-inline-placeholder">${latex}</span>`;
    }
  );

  return html;
}

// ─── Shared components ────────────────────────────────────────────────────
function ToolBtn({ onClick, active, disabled, title, children, className: cls }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded-lg transition-all select-none flex items-center justify-center shrink-0',
        'w-7 h-7',
        active
          ? 'bg-primary/20 text-primary shadow-sm shadow-primary/10'
          : 'text-text-muted hover:text-text hover:bg-white/8',
        disabled && 'opacity-25 cursor-not-allowed pointer-events-none',
        cls
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border/40 mx-0.5 shrink-0" />;
}

// ─── Top toolbar (edit mode) ──────────────────────────────────────────────
function Toolbar({ editor, onPreview, onInsertMath }) {
  if (!editor) return null;
  const ia = (n, a) => editor.isActive(n, a);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-sidebar sticky top-0 z-10">
      <button
        type="button"
        onClick={onPreview}
        title="Mode Baca"
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/30 transition-colors shrink-0 mr-1 hover:bg-primary/25"
      >
        <Eye size={12} /> Pratinjau
      </button>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title="Bold">
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title="Italic">
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title="Underline">
        <UnderlineIcon size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title="Coret">
        <Strikethrough size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title="Rata Kiri">
        <AlignLeft size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title="Tengah">
        <AlignCenter size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title="Rata Kanan">
        <AlignRight size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={ia({ textAlign: 'justify' })} title="Rata Kiri-Kanan">
        <AlignJustify size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title="Daftar Titik">
        <List size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title="Daftar Bernomor">
        <ListOrdered size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title="To-Do List">
        <ListChecks size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={onInsertMath} title="Sisipkan Rumus LaTeX">
        <Pi size={14} />
      </ToolBtn>
    </div>
  );
}

// ─── Color palette ────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  { color: '#F87171', label: 'Merah' },
  { color: '#FB923C', label: 'Oranye' },
  { color: '#FBBF24', label: 'Kuning' },
  { color: '#34D399', label: 'Hijau' },
  { color: '#818CF8', label: 'Ungu' },
  { color: '#38BDF8', label: 'Biru' },
  { color: '#F472B6', label: 'Pink' },
  { color: '#A3A3A3', label: 'Abu' },
];

// ─── Custom floating toolbar (selection-based, pure React) ─────────────────
function FloatingToolbar({ editor, editorMode }) {
  const [pos, setPos] = useState(null);
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (editorMode !== 'edit') { setPos(null); return; }

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const editorEl = document.querySelector('.note-editor-content');
      if (!editorEl || !editorEl.contains(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // Clamp x so toolbar doesn't go off-screen
      const clampedX = Math.max(160, Math.min(rect.left + rect.width / 2, window.innerWidth - 160));
      setPos({ x: clampedX, y: rect.top - 10 });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [editorMode]);

  // Close color popup on outside click
  useEffect(() => {
    if (!showColors) return;
    const handleClick = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColors]);

  if (!pos || !editor) return null;

  const ia = (n, a) => editor.isActive(n, a);

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-50"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -100%)',
        animation: 'noteFloatIn 0.15s ease-out',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-px px-2 py-1.5 bg-[#1a1b2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)]">
        {/* ── Text formatting ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title="Bold">
          <Bold size={12} strokeWidth={2.5} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title="Italic">
          <Italic size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title="Underline">
          <UnderlineIcon size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title="Coret">
          <Strikethrough size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Alignment ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title="Kiri">
          <AlignLeft size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title="Tengah">
          <AlignCenter size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title="Kanan">
          <AlignRight size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Lists ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title="Daftar Titik">
          <List size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title="Daftar Nomor">
          <ListOrdered size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title="To-Do List">
          <ListChecks size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Colors ── */}
        <div className="relative">
          <ToolBtn
            className="!w-6 !h-6"
            onClick={() => setShowColors(v => !v)}
            active={showColors}
            title="Warna Teks"
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 ring-1 ring-white/20" />
          </ToolBtn>
          {showColors && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 px-2 py-1.5 bg-[#1a1b2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              onMouseDown={(e) => e.preventDefault()}
            >
              {COLOR_PALETTE.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { editor.chain().focus().setColor(color).run(); setShowColors(false); }}
                  title={label}
                  className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/60 hover:scale-125 transition-all duration-150 shadow-md"
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="w-px h-4 bg-white/10 mx-0.5" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
                title="Hapus warna"
                className="w-5 h-5 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-[8px] text-white/40 hover:border-white/50 hover:text-white/70 transition-all"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Arrow pointer ── */}
      <div className="flex justify-center">
        <div className="w-2.5 h-2.5 bg-[#1a1b2e]/95 border-r border-b border-white/10 rotate-45 -mt-1.5" />
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function NoteEditor({ content, onSave, noteId }) {
  const [mode, setMode] = useState('view');
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
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MathInline,
      MathBlock,
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

  // Load content ke Tiptap saat masuk edit mode
  useEffect(() => {
    if (!editor) return;
    if (mode === 'edit') {
      (async () => {
        const html = await toHtml(content || '');
        editor.commands.setContent(html, false);
        lastSavedRef.current = html;
        setTimeout(() => editor.commands.focus('end'), 50);
      })();
    }
  }, [noteId, mode, editor, content]);

  // Reset ke view mode saat pindah note
  useEffect(() => { setMode('view'); }, [noteId]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);
  useEffect(() => () => { editor?.destroy(); }, [editor]);

  const handleToggle = () => setMode(m => m === 'view' ? 'edit' : 'view');

  const handleInsertMath = useCallback(() => {
    if (!editor) return;
    const latex = prompt('Masukkan rumus LaTeX:', 'E = mc^2');
    if (latex !== null && latex.trim()) {
      editor.chain().focus().insertMathInline(latex.trim()).run();
    }
  }, [editor]);

  return (
    <div className="flex flex-col h-full">

      {/* ═══ VIEW MODE — bersih, tanpa toolbar ═══ */}
      {mode === 'view' && (
        <div className="flex-1 overflow-y-auto">
          <div
            className="max-w-3xl mx-auto px-10 py-8 cursor-text min-h-full"
            onDoubleClick={handleToggle}
            title="Klik dua kali untuk mengedit"
          >
            <MathMarkdown>{content || ''}</MathMarkdown>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODE — Tiptap WYSIWYG ═══ */}
      {mode === 'edit' && (
        <>
          <Toolbar editor={editor} onPreview={handleToggle} onInsertMath={handleInsertMath} />
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-10 py-8">
              <EditorContent editor={editor} />
            </div>
          </div>
        </>
      )}

      {/* ═══ FLOATING TOOLBAR — custom, pure React, no BubbleMenu ═══ */}
      <FloatingToolbar editor={editor} editorMode={mode} />

      {/* ═══ Floating edit/preview button ═══ */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'fixed bottom-6 right-6 z-20',
          'p-3 rounded-full shadow-xl',
          'bg-primary text-white hover:bg-primary/90',
          'transition-all hover:scale-105'
        )}
        title={mode === 'view' ? 'Edit catatan' : 'Pratinjau'}
      >
        {mode === 'view' ? <Edit3 size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
