/**
 * MathMarkdown — shared renderer for all AI output in Kabayan AI.
 *
 * Pipeline:
 *   raw string
 *   → normalizeMathDelimiters()   (convert \[..\] and \(..\) → $$ / $,
 *                                  skipping fenced code blocks and inline code)
 *   → ReactMarkdown + remarkGfm + remarkMath + rehypeKatex
 *
 * sanitizeUnpairedDelimiters is intentionally NOT called here.
 * rehype-katex handles parse errors gracefully via throwOnError: false.
 * The previous sanitizer was corrupting markdown (##, **, *, ---).
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

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

  // Split into alternating [prose, code, prose, code, ...] segments.
  // The regex captures fenced code blocks AND inline code so we can skip them.
  // Pattern: ```...``` (fenced, lazy) OR `...` (inline code, no newlines)
  const CODE_FENCE = /(```[\s\S]*?```|`[^`\n]*`)/g;

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
  // Block double-escaped: \\[...\\]  →  $$\n...\n$$
  text = text.replace(/\\{2}\[([\s\S]*?)\\{2}\]/g,
    (_, inner) => `$$\n${inner.trim()}\n$$`);

  // Block single-escaped: \[...\]  →  $$\n...\n$$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g,
    (_, inner) => `$$\n${inner.trim()}\n$$`);

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
 * SAFE version: only strips a trailing unpaired $$ at the very end of the
 * string (mid-stream scenario). Does NOT touch single $ or anything else.
 *
 * The previous version used a ## substitution that corrupted ## headings
 * and other markdown. This version is conservative: one targeted check only.
 */
export function sanitizeUnpairedDelimiters(text) {
  if (!text) return text;

  const blockMatches = text.match(/\$\$/g) || [];
  if (blockMatches.length % 2 !== 0) {
    // Remove only the last dangling $$ token, keep everything else
    const lastIdx = text.lastIndexOf('$$');
    if (lastIdx !== -1) {
      text = text.slice(0, lastIdx) + text.slice(lastIdx + 2);
    }
  }

  return text;
}

// ─── 3. Code block renderer ───────────────────────────────────────────────────
function CodeBlock({ node, inline, className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  if (!inline && match) {
    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        className="rounded-xl !text-xs !my-2"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }
  return (
    <code
      className={`${className || ''} bg-card border border-border rounded px-1 py-0.5 text-xs font-mono text-text`}
      {...props}
    >
      {children}
    </code>
  );
}

// ─── 4. Main component ────────────────────────────────────────────────────────
export default function MathMarkdown({ children = '', className = '' }) {
  if (!children) return null;

  const raw = String(children);
  const normalized = normalizeMathDelimiters(raw);
  const safe = sanitizeUnpairedDelimiters(normalized);

  return (
    <div className={`prose-dark text-sm leading-relaxed ${className}`}>
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
