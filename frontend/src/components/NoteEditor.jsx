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
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { MathInline, MathBlock } from '@/extensions/math';
import { FontSize, FONT_SIZE_OPTIONS } from '@/extensions/fontSize';
import DomCopyEnhancer from '@/components/DomCopyEnhancer';

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
function ToolBtn({ onClick, active, disabled, title, children, className: cls, size = 'md', tooltipSide = 'bottom' }) {
  return (
      <Tooltip label={title} side={tooltipSide}>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClick(); }}
          disabled={disabled}
          className={cn(
          'rounded-lg transition-all select-none flex items-center justify-center shrink-0',
          size === 'sm' ? 'w-7 h-7 p-1' : 'w-8 h-8 p-1.5',
          active
            ? 'bg-primary/15 text-primary-light border border-primary/20 shadow-sm'
            : 'text-text-secondary hover:text-text hover:bg-card-hover border border-transparent',
          disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
          cls
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />;
}

function SepV() {
  return <div className="h-px w-5 bg-border my-1 shrink-0" />;
}

// ─── Font size dropdown (top toolbar + floating bubble) ───────────────────
function FontSizeDropdown({ editor, floating = false, vertical = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [liveSize, setLiveSize] = useState(14);
  const wrapRef = useRef(null);

  // Re baca fontSize dari selection setiap kali editor state berubah.
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

  // Posisi popup dihitung dari rect tombol lalu dirender via portal `fixed`
  // ke document.body — tidak terpotong overflow parent (toolbar scrollable,
  // rail vertikal) dan tidak transparan.
  const [coords, setCoords] = useState(null);
  const measure = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (vertical) {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left - 6,
        align: 'left-center',
      });
      return;
    }
    setCoords({
      top: rect.top > 260 ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      align: rect.top > 260 ? 'bottom-left' : 'top-left',
    });
  };
  useEffect(() => {
    if (!open) { setCoords(null); return; }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, floating, vertical]);

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
      <Tooltip label={t('noteEditor.fontSize')} side={vertical ? 'right' : floating ? 'top' : 'bottom'}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(v => !v)}
          className={cn(
            'rounded-lg transition-all select-none flex items-center justify-center gap-1 font-medium border border-transparent',
            vertical ? 'w-9 h-8 text-xs' : floating ? 'w-8 h-7 text-xs' : 'w-11 h-8 text-xs',
            open
              ? 'bg-primary/15 text-primary shadow-sm border-primary/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          )}
        >
          {label}
          <svg width="6" height="4" viewBox="0 0 6 4" className="opacity-70 shrink-0">
            <path d="M0 0h6L3 4z" fill="currentColor" />
          </svg>
        </button>
      </Tooltip>

      {open && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'fixed z-[80] flex flex-col overflow-y-auto rounded-xl shadow-modal border border-strong bg-popover p-1'
            )}
            style={{
              maxHeight: 200,
              ...(coords.align === 'left-center' && {
                top: coords.top,
                left: coords.left,
                transform: 'translate(-100%, -50%)',
              }),
              ...(coords.align === 'top-left' && {
                top: coords.top,
                left: coords.left,
              }),
              ...(coords.align === 'bottom-left' && {
                top: coords.top,
                left: coords.left,
                transform: 'translateY(-100%)',
              }),
            }}
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
                    : 'text-text hover:bg-wash'
                )}
                style={{ fontSize: Math.max(size * 0.8, 9) }}
              >
                {size}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Top toolbar (edit mode) ──────────────────────────────────────────────
function Toolbar({ editor, onPreview, onInsertMath, className = '' }) {
  const { t } = useTranslation();
  if (!editor) return null;
  const ia = (n, a) => editor.isActive(n, a);

  return (
    <div className={cn('flex flex-nowrap items-center gap-1 px-3 py-1.5 bg-wash/40 border-b border-strong/50 sticky top-0 z-10 overflow-x-auto sidebar-scroll shrink-0', className)}>
      <Tooltip label={t('noteEditor.readMode')}>
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 transition-all shrink-0 mr-2 hover:bg-primary hover:text-white shadow-sm"
        >
          <Icon name={ICONS.ui.eye} size={14} /> {t('noteEditor.preview')}
        </button>
      </Tooltip>

      <Sep />
      <FontSizeDropdown editor={editor} />
      <Sep />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('noteEditor.undo')}>
        <Icon name={ICONS.editor.undo} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('noteEditor.redo')}>
        <Icon name={ICONS.editor.redo} size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title={t('noteEditor.bold')}>
        <Icon name={ICONS.editor.bold} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title={t('noteEditor.italic')}>
        <Icon name={ICONS.editor.italic} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title={t('noteEditor.underline')}>
        <Icon name={ICONS.editor.underline} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title={t('noteEditor.strike')}>
        <Icon name={ICONS.editor.strikethrough} size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title={t('noteEditor.alignLeft')}>
        <Icon name={ICONS.editor.alignLeft} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title={t('noteEditor.alignCenter')}>
        <Icon name={ICONS.editor.alignCenter} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title={t('noteEditor.alignRight')}>
        <Icon name={ICONS.editor.alignRight} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={ia({ textAlign: 'justify' })} title={t('noteEditor.alignJustify')}>
        <Icon name={ICONS.editor.alignJustify} size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title={t('noteEditor.bulletList')}>
        <Icon name={ICONS.editor.list} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title={t('noteEditor.orderedList')}>
        <Icon name={ICONS.editor.listOrdered} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title={t('noteEditor.todoList')}>
        <Icon name={ICONS.editor.listChecks} size={14} />
      </ToolBtn>

      <Sep />
      <ToolBtn size="sm" onClick={onInsertMath} title={t('noteEditor.insertMath')}>
        <Icon name={ICONS.editor.pi} size={14} />
      </ToolBtn>
    </div>
  );
}

// ─── Vertical rail toolbar (desktop, right side, outside the paper) ────────
export function VerticalToolbar({ editor, onPreview, onInsertMath, className = '' }) {
  const { t } = useTranslation();
  if (!editor) return null;
  const ia = (n, a) => editor.isActive(n, a);

  return (
    <div
      className={cn(
        'flex-col items-center gap-1 py-3 px-2 bg-surface border border-border rounded-xl shadow-card shrink-0 my-3 max-h-[calc(100%-1.5rem)] overflow-y-auto sidebar-scroll',
        className
      )}
    >
      <FontSizeDropdown editor={editor} vertical />
      <SepV />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={t('noteEditor.undo')} tooltipSide="left">
        <Icon name={ICONS.editor.undo} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={t('noteEditor.redo')} tooltipSide="left">
        <Icon name={ICONS.editor.redo} size={14} />
      </ToolBtn>
      <SepV />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title={t('noteEditor.bold')} tooltipSide="left">
        <Icon name={ICONS.editor.bold} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title={t('noteEditor.italic')} tooltipSide="left">
        <Icon name={ICONS.editor.italic} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title={t('noteEditor.underline')} tooltipSide="left">
        <Icon name={ICONS.editor.underline} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title={t('noteEditor.strike')} tooltipSide="left">
        <Icon name={ICONS.editor.strikethrough} size={14} />
      </ToolBtn>
      <SepV />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title={t('noteEditor.alignLeft')} tooltipSide="left">
        <Icon name={ICONS.editor.alignLeft} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title={t('noteEditor.alignCenter')} tooltipSide="left">
        <Icon name={ICONS.editor.alignCenter} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title={t('noteEditor.alignRight')} tooltipSide="left">
        <Icon name={ICONS.editor.alignRight} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={ia({ textAlign: 'justify' })} title={t('noteEditor.alignJustify')} tooltipSide="left">
        <Icon name={ICONS.editor.alignJustify} size={14} />
      </ToolBtn>
      <SepV />
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title={t('noteEditor.bulletList')} tooltipSide="left">
        <Icon name={ICONS.editor.list} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title={t('noteEditor.orderedList')} tooltipSide="left">
        <Icon name={ICONS.editor.listOrdered} size={14} />
      </ToolBtn>
      <ToolBtn size="sm" onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title={t('noteEditor.todoList')} tooltipSide="left">
        <Icon name={ICONS.editor.listChecks} size={14} />
      </ToolBtn>
      <SepV />
      <ToolBtn size="sm" onClick={onInsertMath} title={t('noteEditor.insertMath')} tooltipSide="left">
        <Icon name={ICONS.editor.pi} size={14} />
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
      <div className="flex items-center gap-px px-2 py-1.5 bg-popover border border-strong rounded-lg shadow-modal">
        {/* ── Font size ── */}
        <FontSizeDropdown editor={editor} floating />
        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* ── Text formatting ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBold().run()} active={ia('bold')} title={t('noteEditor.bold')}>
          <Icon name={ICONS.editor.bold} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleItalic().run()} active={ia('italic')} title={t('noteEditor.italic')}>
          <Icon name={ICONS.editor.italic} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleUnderline().run()} active={ia('underline')} title={t('noteEditor.underline')}>
          <Icon name={ICONS.editor.underline} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleStrike().run()} active={ia('strike')} title={t('noteEditor.strike')}>
          <Icon name={ICONS.editor.strikethrough} size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* ── Alignment ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={ia({ textAlign: 'left' })} title={t('noteEditor.left')}>
          <Icon name={ICONS.editor.alignLeft} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={ia({ textAlign: 'center' })} title={t('noteEditor.alignCenter')}>
          <Icon name={ICONS.editor.alignCenter} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={ia({ textAlign: 'right' })} title={t('noteEditor.right')}>
          <Icon name={ICONS.editor.alignRight} size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* ── Lists ── */}
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleBulletList().run()} active={ia('bulletList')} title={t('noteEditor.bulletList')}>
          <Icon name={ICONS.editor.list} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={ia('orderedList')} title={t('noteEditor.numberedList')}>
          <Icon name={ICONS.editor.listOrdered} size={12} />
        </ToolBtn>
        <ToolBtn className="!w-6 !h-6" onClick={() => editor.chain().focus().toggleTaskList().run()} active={ia('taskList')} title={t('noteEditor.todoList')}>
          <Icon name={ICONS.editor.listChecks} size={12} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* ── Colors ── */}
        <div className="relative">
          <ToolBtn
            className="!w-6 !h-6"
            onClick={() => setShowColors(v => !v)}
            active={showColors}
            title={t('noteEditor.textColor')}
          >
            <div className="w-3 h-3 rounded-full bg-warning ring-1 ring-primary/30" />
          </ToolBtn>
          {showColors && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 px-2 py-1.5 bg-popover border border-strong rounded-xl shadow-modal"
              onMouseDown={(e) => e.preventDefault()}
            >
              {COLOR_PALETTE.map(({ color, labelKey }) => (
                <Tooltip key={color} label={t('noteEditor.' + labelKey)}>
                  <button
                    type="button"
                    onClick={() => applyColor(color)}
                    className="w-5 h-5 rounded-full border-2 border-transparent border-strong hover:scale-125 transition-all duration-150 shadow-md"
                    style={{ backgroundColor: color }}
                  />
                </Tooltip>
              ))}
              <div className="w-px h-4 bg-border mx-0.5" />
              <Tooltip label={t('noteEditor.clearColor')}>
                <button
                  type="button"
                  onClick={clearColor}
                  className="w-5 h-5 rounded-full border-2 border-dashed border-strong flex items-center justify-center text-2xs text-text-muted hover:border-strong hover:text-text transition-all"
                >
                  <Icon name={ICONS.actions.close} size={9} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* ── Arrow pointer ── */}
      <div className="flex justify-center">
        <div className="w-2.5 h-2.5 bg-popover border-r border-b border-strong rotate-45 -mt-1.5" />
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function NoteEditor({
  content,
  onSave,
  noteId,
  defaultMode = 'view',
  mode,
  onModeChange,
  onEditorReady,
}) {
  const { t } = useTranslation();
  const [internalMode, setInternalMode] = useState(defaultMode);
  const activeMode = mode ?? internalMode;
  const setMode = (m) => {
    if (mode !== undefined) onModeChange?.(m);
    else setInternalMode(m);
  };
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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
  // Expose editor instance ke parent (untuk vertical rail di luar kertas)
  useEffect(() => { if (editor) onEditorReady?.(editor); }, [editor, onEditorReady]);

  // Load content ke Tiptap saat masuk edit mode.
  // Hanya dimuat SEKALI per note — toggle view/edit tidak boleh me-reset
  // editor (setContent ulang menimpa format font size/warna yang sudah
  // diterapkan user, padahal content prop masih markdown lama).
  const loadedNoteIdRef = useRef(null);
  useEffect(() => {
    if (!editor) return;
    if (activeMode !== 'edit') return;
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
  }, [noteId, activeMode, editor, content]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);
  useEffect(() => () => { editor?.destroy(); }, [editor]);

  const handleToggle = () => setMode(m => (m === 'view' ? 'edit' : 'view'));

  const handleInsertMath = useCallback(() => {
    if (!editor) return;
    const latex = prompt(t('noteEditor.mathPrompt'), 'E = mc^2');
    if (latex !== null && latex.trim()) {
      editor.chain().focus().insertMathInline(latex.trim()).run();
    }
  }, [editor, t]);

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ═══ VIEW MODE — bersih, tanpa toolbar, scroll terisolasi ═══
          EditorContent tetap di-mount (hidden) agar toggle tidak me-remount
          node view Tiptap -> menghindari flushSync + snap. */}
      {activeMode === 'view' && (
        <div className="flex-1 overflow-y-auto overscroll-contain sidebar-scroll">
          <Tooltip label={t('noteEditor.doubleClickToEdit')}>
            <div
              className="w-full max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8 py-10 cursor-text min-h-full"
              onDoubleClick={handleToggle}
            >
            <MathMarkdown>{content || ''}</MathMarkdown>
          </div>
          </Tooltip>
        </div>
      )}

      {/* ═══ EDIT MODE — Tiptap WYSIWYG, scroll terisolasi ═══
          EditorContent selalu di-mount, disembunyikan via `hidden` saat view
          (tanpa unmount) sehingga tidak memicu flushSync saat toggle.
          Toolbar horizontal hanya untuk <lg (rail vertikal di NoteView). */}
      <div className={cn('flex flex-col h-full min-h-0', activeMode === 'view' && 'hidden')}>
        <Toolbar editor={editor} onPreview={handleToggle} onInsertMath={handleInsertMath} className="lg:hidden" />
        <div className="flex-1 overflow-y-auto overscroll-contain sidebar-scroll min-h-0">
          <div className="w-full max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <EditorContent editor={editor} />
          </div>
        </div>
        <DomCopyEnhancer selector=".note-editor-content" />
      </div>

      {/* ═══ FLOATING TOOLBAR — custom, pure React, no BubbleMenu ═══ */}
      <FloatingToolbar editor={editor} editorMode={activeMode} />
    </div>
  );
}