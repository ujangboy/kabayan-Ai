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
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Undo2, Redo2,
  Edit3, Eye, Pi, X,
} from '@/icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { MathInline, MathBlock } from '@/extensions/math';
import { FontSize, FONT_SIZE_OPTIONS } from '@/extensions/fontSize';

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

/**
 * Ambil range selection dari DOM (window.getSelection) lalu konversi ke
 * posisi ProseMirror via posAtDOM. Ini menjamin perintah toolbar (font size,
 * warna) diterapkan PERSIS ke teks yang terlihat terpilih — mencegah kasus
 * di mana state selection editor tidak sinkron dengan selection DOM
 * (penyebab umum "font size tidak bekerja" pada konten AI).
 * Return null jika selection kosong / di luar editor.
 */
function getDomSelectionRange(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const view = editor?.view;
  if (!view) return null;
  try {
    const from = view.posAtDOM(range.startContainer, range.startOffset);
    const to = view.posAtDOM(range.endContainer, range.endOffset);
    if (from === null || to === null || from === undefined || to === undefined) return null;
    return { from: Math.min(from, to), to: Math.max(from, to) };
  } catch {
    return null;
  }
}

// ─── Shared components ────────────────────────────────────────────────────
function ToolBtn({ onClick, active, disabled, title, children, className: cls }) {
  return (
    <Tooltip label={title} side="bottom">
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
    </Tooltip>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border/40 mx-0.5 shrink-0" />;
}

// ─── Font size dropdown (top toolbar + floating bubble) ───────────────────
function FontSizeDropdown({ editor, floating = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState('bottom');
  const [liveSize, setLiveSize] = useState(14);
  const wrapRef = useRef(null);

  // Reactive: baca fontSize dari selection setiap kali editor state berubah.
  // Berlaku untuk toolbar atas MAUPUN floating toolbar (label harus real-time).
  useEffect(() => {
    if (!editor) return;
    const readFontSize = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        const attrs = editor.getAttributes('textStyle') || {};
        const rawSize = attrs.fontSize;
        const px = rawSize ? parseInt(String(rawSize).replace('px', ''), 10) : 14;
        setLiveSize(Number.isFinite(px) ? px : 14);
        return;
      }
      let size = 14;
      editor.state.doc.nodesBetween(from, to, (node) => {
        if (size !== 14) return;
        const marks = node.marks || [];
        for (const mark of marks) {
          if (mark.type.name === 'textStyle' && mark.attrs.fontSize) {
            const px = parseInt(String(mark.attrs.fontSize).replace('px', ''), 10);
            if (Number.isFinite(px)) { size = px; break; }
          }
        }
      });
      setLiveSize(size);
    };
    readFontSize();
    editor.on('selectionUpdate', readFontSize);
    editor.on('transaction', readFontSize);
    return () => {
      editor.off('selectionUpdate', readFontSize);
      editor.off('transaction', readFontSize);
    };
  }, [editor]);

  const label = liveSize;

  // Decide popup direction based on available space
  const measure = () => {
    if (!open || !floating) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(rect.top > 260 ? 'top' : 'bottom');
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, floating]);

  const apply = (size) => {
    const domRange = getDomSelectionRange(editor);
    if (domRange) {
      editor.chain().focus().setTextSelection(domRange).run();
    }
    if (size === 14) {
      editor.commands.unsetFontSize();
    } else {
      editor.commands.setFontSize(`${size}px`);
    }
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(v => !v)}
        title={t('noteEditor.fontSize')}
        className={cn(
          'rounded-lg transition-all select-none flex items-center justify-center gap-0.5 font-medium',
          floating ? 'w-7 h-6 text-[10px]' : 'w-9 h-7 text-[11px]',
          open
            ? 'bg-primary/20 text-primary'
            : 'text-text-muted hover:text-text hover:bg-white/8'
        )}
      >
        {label}
        <svg width="6" height="4" viewBox="0 0 6 4" className="opacity-70 shrink-0">
          <path d="M0 0h6L3 4z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute z-50 flex flex-col overflow-y-auto rounded-xl shadow-xl border p-1',
              floating
                ? 'bg-[#1a1b2e]/95 backdrop-blur-xl border-white/10'
                : 'bg-card border-border',
              pos === 'bottom' ? 'top-full mt-1 left-0' : 'bottom-full mb-1 left-0'
            )}
            style={{ maxHeight: 200 }}
          >
            {FONT_SIZE_OPTIONS.map(size => (
              <button
                key={size}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(size)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-left transition-colors',
                  size === label
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-text hover:bg-white/8'
                )}
                style={{ fontSize: Math.max(size * 0.8, 9) }}
              >
                {size}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Top toolbar (edit mode) ──────────────────────────────────────────────
function Toolbar({ editor, onPreview, onInsertMath }) {
  const { t } = useTranslation();
  if (!editor) return null;
  const ia = (n, a) => editor.isActive(n, a);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-border bg-sidebar sticky top-0 z-10">
      <button
        type="button"
        onClick={onPreview}
        title={t('noteEditor.readMode')}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/30 transition-colors shrink-0 mr-1 hover:bg-primary/25"
      >
        <Eye size={12} /> {t('noteEditor.preview')}
      </button>

      <Sep />
      <FontSizeDropdown editor={editor} />
      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('noteEditor.undo')}>
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('noteEditor.redo')}>
        <Redo2 size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title={t('noteEditor.bold')}>
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title={t('noteEditor.italic')}>
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title={t('noteEditor.underline')}>
        <UnderlineIcon size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title={t('noteEditor.strike')}>
        <Strikethrough size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title={t('noteEditor.alignLeft')}>
        <AlignLeft size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title={t('noteEditor.alignCenter')}>
        <AlignCenter size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title={t('noteEditor.alignRight')}>
        <AlignRight size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={ia({ textAlign: 'justify' })} title={t('noteEditor.alignJustify')}>
        <AlignJustify size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title={t('noteEditor.bulletList')}>
        <List size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title={t('noteEditor.orderedList')}>
        <ListOrdered size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title={t('noteEditor.todoList')}>
        <ListChecks size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn onClick={onInsertMath} title={t('noteEditor.insertMath')}>
        <Pi size={14} />
      </ToolBtn>
    </div>
  );
}

// ─── Color palette ────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  { color: '#FFFFFF', labelKey: 'colorWhite' },
  { color: '#F87171', labelKey: 'colorRed' },
  { color: '#FB923C', labelKey: 'colorOrange' },
  { color: '#FBBF24', labelKey: 'colorYellow' },
  { color: '#34D399', labelKey: 'colorGreen' },
  { color: '#818CF8', labelKey: 'colorPurple' },
  { color: '#38BDF8', labelKey: 'colorBlue' },
  { color: '#F472B6', labelKey: 'colorPink' },
  { color: '#A3A3A3', labelKey: 'colorGray' },
];

// ─── Custom floating toolbar (selection-based, pure React) ─────────────────
function FloatingToolbar({ editor, editorMode }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(null);
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (editorMode !== 'edit') { setPos(null); return; }

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const editorEl = document.querySelector('.note-editor-content');
      if (!editorEl || !editorEl.contains(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }

      // Hanya tampilkan toolbar saat teks di-block/selected (bukan collapsed caret)
      if (sel.isCollapsed) {
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
  }, [editorMode, editor]);

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

  // Terapkan warna ke selection DOM aktual (sinkron posisi ProseMirror),
  // sehingga warna tetap berlaku walau state selection editor tertinggal.
  const applyColor = (color) => {
    const domRange = getDomSelectionRange(editor);
    // Pisahkan 2 dispatch agar tidak double-dispatch
    // (sama seperti fix FontSizeDropdown.apply)
    if (domRange) {
      editor.chain().focus().setTextSelection(domRange).run();
    }
    editor.commands.setColor(color);
    setShowColors(false);
  };

  const clearColor = () => {
    const domRange = getDomSelectionRange(editor);
    if (domRange) {
      editor.chain().focus().setTextSelection(domRange).run();
    }
    editor.commands.unsetColor();
    setShowColors(false);
  };

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
        {/* ── Font size ── */}
        <FontSizeDropdown editor={editor} floating />
        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Text formatting ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title={t('noteEditor.bold')}>
          <Bold size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title={t('noteEditor.italic')}>
          <Italic size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title={t('noteEditor.underline')}>
          <UnderlineIcon size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title={t('noteEditor.strike')}>
          <Strikethrough size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Alignment ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title={t('noteEditor.left')}>
          <AlignLeft size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title={t('noteEditor.alignCenter')}>
          <AlignCenter size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title={t('noteEditor.right')}>
          <AlignRight size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Lists ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title={t('noteEditor.bulletList')}>
          <List size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title={t('noteEditor.numberedList')}>
          <ListOrdered size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title={t('noteEditor.todoList')}>
          <ListChecks size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* ── Colors ── */}
        <div className="relative">
          <ToolBtn
            className="!w-6 !h-6"
            onClick={() => setShowColors(v => !v)}
            active={showColors}
            title={t('noteEditor.textColor')}
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 ring-1 ring-white/20" />
          </ToolBtn>
          {showColors && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 px-2 py-1.5 bg-[#1a1b2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              onMouseDown={(e) => e.preventDefault()}
            >
              {COLOR_PALETTE.map(({ color, labelKey }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => applyColor(color)}
                  title={t('noteEditor.' + labelKey)}
                  className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/60 hover:scale-125 transition-all duration-150 shadow-md"
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="w-px h-4 bg-white/10 mx-0.5" />
              <button
                type="button"
                onClick={clearColor}
                title={t('noteEditor.clearColor')}
                className="w-5 h-5 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-[8px] text-white/40 hover:border-white/50 hover:text-white/70 transition-all"
              >
                <X size={9} />
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
export default function NoteEditor({ content, onSave, noteId, defaultMode = 'view' }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(defaultMode);
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      FontSize,
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

  // Load content ke Tiptap saat masuk edit mode.
  // Hanya dimuat SEKALI per note — toggle view/edit tidak boleh me-reset
  // editor (setContent ulang menimpa format font size/warna yang sudah
  // diterapkan user, padahal content prop masih markdown lama).
  const loadedNoteIdRef = useRef(null);
  useEffect(() => {
    if (!editor) return;
    if (mode !== 'edit') return;
    if (loadedNoteIdRef.current === noteId) return;
    loadedNoteIdRef.current = noteId;
    (async () => {
      const html = await toHtml(content || '');
      lastSavedRef.current = html;
      // Defer setContent ke scheduler task — memanggilnya langsung di dalam
      // lifecycle method memicu warning "flushSync was called from inside a
      // lifecycle method" dari Tiptap ReactNodeViewRenderer.
      setTimeout(() => {
        editor.commands.setContent(html, false);
        setTimeout(() => editor.commands.focus('end'), 50);
      }, 0);
    })();
  }, [noteId, mode, editor, content]);

  // Reset ke default mode saat pindah note
  useEffect(() => { setMode(defaultMode); }, [noteId]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);
  useEffect(() => () => { editor?.destroy(); }, [editor]);

  const handleToggle = () => setMode(m => m === 'view' ? 'edit' : 'view');

  const handleInsertMath = useCallback(() => {
    if (!editor) return;
    const latex = prompt(t('noteEditor.mathPrompt'), 'E = mc^2');
    if (latex !== null && latex.trim()) {
      editor.chain().focus().insertMathInline(latex.trim()).run();
    }
  }, [editor, t]);

  return (
    <div className="flex flex-col h-full">

      {/* ═══ VIEW MODE — bersih, tanpa toolbar ═══ */}
      {mode === 'view' && (
        <div className="flex-1 overflow-y-auto">
          <div
            className="max-w-3xl mx-auto px-10 py-8 cursor-text min-h-full"
            onDoubleClick={handleToggle}
            title={t('noteEditor.doubleClickToEdit')}
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
        title={mode === 'view' ? t('noteEditor.editNote') : t('noteEditor.preview')}
      >
        {mode === 'view' ? <Edit3 size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
