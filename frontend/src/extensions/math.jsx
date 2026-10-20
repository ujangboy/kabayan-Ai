/**
 * KaTeX extensions for Tiptap — renders LaTeX in edit mode.
 *
 * MathInline: $...$  → renders inline KaTeX
 * MathBlock:  $$...$$ → renders block KaTeX
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import katex from 'katex';
import { Tooltip } from '@/components/ui/Tooltip';

// KaTeX `trust: true` mengizinkan \href, \html*, dan \includegraphics.
// Konten LaTeX berasal dari input user, jadi jangan pernah mengaktifkannya.
// Fallback error juga harus di-escape sebelum masuk dangerouslySetInnerHTML.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

// ─── KaTeX React renderer ────────────────────────────────────────────────
function KaTeXNode({ node, updateAttributes }) {
  const { latex } = node.attrs;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(latex);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== latex) {
      updateAttributes({ latex: trimmed });
    }
  }, [draft, latex, updateAttributes]);

  if (isEditing) {
    return (
      <NodeViewWrapper as="span" className="inline-flex">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setIsEditing(false); setDraft(latex); }
          }}
          onBlur={handleSave}
          className="font-mono text-xs bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 text-text outline-none min-w-[80px]"
          placeholder="LaTeX..."
        />
      </NodeViewWrapper>
    );
  }

  const isBlock = node.type.name === 'mathBlock';

  let html = '';
  try {
    html = katex.renderToString(latex || '?', {
      throwOnError: false,
      displayMode: isBlock,
      trust: false,
    });
  } catch {
    html = `<span style="color:var(--warning,#F6B93B);display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${escapeHtml(latex)}</span>`;
  }

  return (
    <NodeViewWrapper
      as={isBlock ? 'div' : 'span'}
      className={`${isBlock ? 'my-2 overflow-x-auto flex justify-center' : ''} cursor-pointer hover:bg-primary/5 rounded px-1 transition-colors`}
      onClick={() => { setDraft(latex); setIsEditing(true); }}
    >
      <Tooltip label="Klik untuk edit LaTeX">
        <NodeViewWrapper
          as={isBlock ? 'div' : 'span'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Tooltip>
    </NodeViewWrapper>
  );
}

// ─── MathInline extension ────────────────────────────────────────────────
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-inline]',
        getAttrs: (el) => ({ latex: el.getAttribute('data-latex') || el.textContent || '' }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KaTeXNode);
  },

  addInputRules() {
    return [
      {
        find: /\$([^$\n]+?)\$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          const { tr } = state;
          const node = this.type.create({ latex });
          tr.replaceWith(range.from, range.to, node);
        },
      },
    ];
  },

  addCommands() {
    return {
      insertMathInline:
        (latex) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { latex },
          }),
    };
  },
});

// ─── MathBlock extension ─────────────────────────────────────────────────
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (el) => ({ latex: el.getAttribute('data-latex') || el.textContent || '' }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KaTeXNode);
  },

  addInputRules() {
    return [
      {
        find: /\$\$([^$]+?)\$\$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          const { tr } = state;
          const node = this.type.create({ latex });
          tr.replaceWith(range.from, range.to, node);
        },
      },
    ];
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { latex },
          }),
    };
  },
});