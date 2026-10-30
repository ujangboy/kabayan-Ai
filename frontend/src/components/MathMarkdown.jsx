/**
 * MathMarkdown — shared renderer for all AI output in Kabayan Pintar.
 *
 * Pipeline:
 *   raw string
 *   → normalizeMathDelimiters()   (convert \[..\] and \(..\) → $$ / $,
 *                                  skipping fenced code blocks and inline code)
 *   → sanitizeUnpairedDelimiters() (hapus $$ yatim & escape $ tunggal yatim,
 *                                  tanpa menyentuh code maupun markdown lain)
 *   → ReactMarkdown + remarkGfm + remarkMath + rehypeKatex
 *
 * rehype-katex tetap memakai throwOnError: false sebagai jaring pengaman.
 */
import ReactMarkdown from 'react-markdown';
import { lazy, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Icon, Tooltip } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { copyText, tableToTSV, tableToMarkdown } from '@/utils/copyTable';
import 'katex/dist/katex.min.css';

// Syntax highlighter di-lazy-load + PrismLight (bahasa terdaftar terbatas)
// agar tidak masuk critical bundle — blok kode jarang tampil di first paint.
const HighlightedCode = lazy(() => import('./HighlightedCode'));

// ─── 1. Delimiter normalization ───────────────────────────────────────────────
/**
 * Convert LaTeX delimiter variants into $...$ / $$...$$ that remark-math needs.
 *
 * Rules:
 *   - Fenced code blocks (``` ... ```) are left untouched.
 *   - Inline code (`...`) is left untouched.
 *   - Only \[...\], \\[...\\], \(...\), \\(...\\) are converted.
 *   - Nothing else in the string is modified.
 *
 * Strategy:
 *   Split the string into segments: code (protected) vs prose (convertible).
 *   Only run regex on prose segments.
 */
export function normalizeMathDelimiters(text) {
  if (!text) return text;

  // Split into alternating [prose, protected, prose, ...] segments.
  // The regex captures fenced code, inline code, dan blok math yang SUDAH
  // ber-delimiter — semuanya tidak boleh diproses ulang.
  const CODE_FENCE = /(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$)/g;

  const parts = text.split(CODE_FENCE);

  const result = parts.map((part, i) => {
    // Odd-index parts are the captured code segments — leave untouched
    if (i % 2 === 1) return part;

    // Even-index parts are prose — apply math delimiter conversion
    return convertDelimiters(part);
  });

  return result.join('');
}

/**
 * Apply the four math delimiter conversions to a prose-only string segment.
 * Order: double-escaped BEFORE single-escaped, block BEFORE inline.
 */
function convertDelimiters(text) {
  // Dollar literal `\$` → penanda visual (fullwidth) SEBELUM remark-math.
  // Tanpa ini, remark-math memperlakukan `$` pada `\$ 8,00` sebagai pembuka
  // math dan menelan seluruh teks (termasuk blok kode) sampai `$` berikutnya
  // menjadi satu latex-error (bug "pre hilang di pesan campuran").
  text = text.replace(/\\\$/g, '\uFF04');

  // `\[...\]` hanya jadi block math ($$) bila diawal baris — di tengah baris,
  // micromark TIDAK menganggap `$$` mid-line sebagai block opener; `$$` lalu
  // dipakai sbg inline opening & menelan sisa teks sampai `$` berikutnya.
  // Mid-line diamankan jadi inline math `$...$` (KaTeX sama-sama render).
  const atLineStart = (t, offset) => {
    const lineBegin = t.lastIndexOf('\n', offset - 1) + 1;
    return /^[\t ]*$/.test(t.slice(lineBegin, offset));
  };

  // LaTeX mentah tanpa delimiter (model kadang lupa membungkus) → math.
  // Tanpa ini, \begin{cases}...\end{cases} tampil sebagai teks mentah di UI.
  text = text.replace(/(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g,
    (body, _inner, offset, full) => atLineStart(full, offset)
      ? `$$\n${body}\n$$`
      : `$${body}$`);

  // Literal `\n` dari JSON yang ter-escape ganda → newline sungguhan.
  // `\\n` (dua backslash) sengaja tidak disentuh: itu line break LaTeX.
  text = text.replace(/(?<!\\)\\n/g, '\n');
  text = text.replace(/\\{2}\[([\s\S]*?)\\{2}\]/g,
    (_, inner, offset, full) => atLineStart(full, offset)
      ? `$$\n${inner.trim()}\n$$`
      : `$${inner.trim()}$`);
  text = text.replace(/\\\[([\s\S]*?)\\\]/g,
    (_, inner, offset, full) => atLineStart(full, offset)
      ? `$$\n${inner.trim()}\n$$`
      : `$${inner.trim()}$`);

  // Inline double-escaped: \\(...\\)  →  $...$
  text = text.replace(/\\{2}\(([\s\S]*?)\\{2}\)/g,
    (_, inner) => `$${inner}$`);

  // Inline single-escaped: \(...\)  →  $...$
  text = text.replace(/\\\(([\s\S]*?)\\\)/g,
    (_, inner) => `$${inner}$`);

  return text;
}

// ─── 2. Unpaired delimiter sanitizer ─────────────────────────────────────────
/**
 * SAFE version: strips a trailing unpaired $$ and escapes a trailing unpaired
 * single $ so remark-math cannot swallow the rest of the message as one giant
 * formula (the usual "KaTeX error" cause). Code spans and complete $$...$$
 * blocks are left untouched.
 */
export function sanitizeUnpairedDelimiters(text) {
  if (!text) return text;

  // Mask code spans/fences with spaces (panjang sama) agar indeks tetap valid.
  const maskCode = (s) => s
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  let masked = maskCode(text);

  const blockMatches = masked.match(/(?<!\\)\$\$/g) || [];
  if (blockMatches.length % 2 !== 0) {
    // Remove only the last dangling $$ token, keep everything else
    const lastIdx = masked.lastIndexOf('$$');
    if (lastIdx !== -1) {
      text = text.slice(0, lastIdx) + text.slice(lastIdx + 2);
      masked = maskCode(text);
    }
  }

  // Hitung single $ hanya di luar code dan blok $$...$$.
  const prose = masked.replace(/(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$/g, (m) => ' '.repeat(m.length));
  const singles = [...prose.matchAll(/(?<!\\)\$/g)];

  if (singles.length % 2 === 1) {
    // Escape the last unpaired single $ so it cannot swallow the rest as math.
    const idx = singles[singles.length - 1].index;
    text = `${text.slice(0, idx)}\\$${text.slice(idx + 1)}`;
  }

  return text;
}

// ─── 3. Code block renderer ───────────────────────────────────────────────────
function CodeBlock({ node, inline, className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  if (!inline && match) {
    return (
      <Suspense
        fallback={
          <pre className="rounded-xl !text-xs !my-2 bg-code-bg p-4 overflow-x-auto">
            <code>{String(children).replace(/\n$/, '')}</code>
          </pre>
        }
      >
        <HighlightedCode
          language={match[1]}
          className="rounded-xl !text-xs !my-2"
        >
          {String(children).replace(/\n$/, '')}
        </HighlightedCode>
      </Suspense>
    );
  }
  return (
    <code
      className={`${className || ''} bg-card border border-border rounded px-1 py-0.5 text-[0.85em] font-mono text-text break-words`}
      {...props}
    >
      {children}
    </code>
  );
}

// ─── 3b. Copy controls (code + table) ────────────────────────────────────────
function CopyBar({ kind, getText, t }) {
  const [state, setState] = useState('idle');
  const onClick = async () => {
    const ok = await copyText(getText() || '');
    setState(ok ? 'ok' : 'err');
    setTimeout(() => setState('idle'), 1400);
  };
  const label =
    kind === 'code'
      ? t('noteEditor.copyCode')
      : kind === 'excel'
      ? t('noteEditor.copyTableExcel')
      : t('noteEditor.copyTableMarkdown');
  return (
    <Tooltip label={label}>
      <button type="button" onClick={onClick} className="dom-copy-btn" aria-label={label}>
        {kind !== 'code' && <span className="dom-copy-label">{kind === 'excel' ? 'Excel' : 'MD'}</span>}
        {state === 'ok' ? (
          <Icon name={ICONS.ui.check} size={13} />
        ) : (
          <Icon name={ICONS.ui.copy} size={13} />
        )}
        {state === 'ok' && <span className="dom-copy-label">{t('noteEditor.copied')}</span>}
      </button>
    </Tooltip>
  );
}

function PreBlock({ t, children, ...rest }) {
  const ref = useRef(null);
  return (
    <div className="md-pre-wrap group relative my-5">
      <div className="dom-copy-bar">
        <CopyBar kind="code" t={t} getText={() => ref.current?.innerText || ''} />
      </div>
      <pre ref={ref} {...rest}>{children}</pre>
    </div>
  );
}

function TableBlock({ t, children, ...rest }) {
  const ref = useRef(null);
  return (
    <div className="md-table-wrap group relative my-5 overflow-x-auto">
      <div className="dom-copy-bar">
        <CopyBar kind="excel" t={t} getText={() => tableToTSV(ref.current)} />
        <CopyBar kind="md" t={t} getText={() => tableToMarkdown(ref.current)} />
      </div>
      <table ref={ref} {...rest}>{children}</table>
    </div>
  );
}

// ─── 4. Main component ────────────────────────────────────────────────────────
export default function MathMarkdown({ children = '', className = '', isStreaming = false }) {
  const { t } = useTranslation();
  if (!children) return null;

  const raw = String(children);
  const normalized = normalizeMathDelimiters(raw);
  // Selalu bersihkan delimiter yang belum berpasangan (bukan hanya saat
  // streaming) — teks final dari AI juga bisa berakhir dengan $ tunggal.
  const safe = sanitizeUnpairedDelimiters(normalized);

  return (
    <div className={`prose-dark text-15 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          // B9: rehypeRaw mengizinkan HTML mentah → wajib disanitasi
          // dengan rehype-sanitize SEBELUM rehype-katex (output katex aman,
          // di-generate dari LaTeX yang sudah di-escape oleh katex sendiri).
          rehypeRaw,
          rehypeSanitize,
          [
            rehypeKatex,
            {
              throwOnError: false,
              errorColor: 'var(--warning, #F6B93B)',
              strict: false,
            },
          ],
        ]}
        components={{
          code: CodeBlock,
          pre: (props) => <PreBlock t={t} {...props} />,
          table: (props) => <TableBlock t={t} {...props} />,
          div({ node, className: cls, children: ch, ...rest }) {
            if (cls && cls.includes('math-display')) {
              return (
                <div className={`${cls} overflow-x-auto py-3 my-3`} {...rest}>
                  {ch}
                </div>
              );
            }
            return <div className={cls} {...rest}>{ch}</div>;
          },
        }}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}