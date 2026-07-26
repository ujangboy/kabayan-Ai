/**
 * Unit tests for MathMarkdown pipeline utilities.
 *
 * Run:  npm test
 */
import { describe, it, expect } from 'vitest';
import { normalizeMathDelimiters, sanitizeUnpairedDelimiters } from './MathMarkdown.jsx';

// ─── normalizeMathDelimiters ──────────────────────────────────────────────────

describe('normalizeMathDelimiters', () => {

  // ── Core delimiter conversions ──────────────────────────────────────────────

  it('converts \\[...\\] block to $$...$$', () => {
    const input = '\\[E=mc^2\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('E=mc^2');
    expect(result).not.toContain('\\[');
    expect(result).not.toContain('\\]');
  });

  it('converts multiline \\[...\\] block to $$...$$', () => {
    const input = 'Jawaban:\n\\[\n\\frac{a+b}{c}\n\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('\\frac{a+b}{c}');
    expect(result).not.toContain('\\[');
  });

  it('converts \\(...\\) inline to $...$', () => {
    const input = 'Kecepatan adalah \\(v = s/t\\) meter per detik.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('Kecepatan adalah $v = s/t$ meter per detik.');
  });

  it('converts double-escaped \\\\[...\\\\] block', () => {
    const input = String.raw`\\[\int_0^1 x^2\,dx\\]`;
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('\\int_0^1 x^2');
  });

  it('converts double-escaped \\\\(...\\\\) inline', () => {
    const input = String.raw`\\(x = 7\\)`;
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$x = 7$');
  });

  // ── Already-correct delimiters unchanged ───────────────────────────────────

  it('does not touch already-correct $...$ inline', () => {
    const input = 'Energi adalah $E = mc^2$ dalam fisika.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch already-correct $$...$$ block', () => {
    const input = '$$\n\\frac{a+b}{c}\n$$';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  // ── Math formula types ─────────────────────────────────────────────────────

  it('handles integral block correctly', () => {
    const input = '\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('\\int_0^1');
    expect(result).toContain('\\frac{1}{3}');
  });

  it('handles matrix block correctly', () => {
    const input = '\\[\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('\\begin{bmatrix}');
  });

  it('handles sigma / summation block', () => {
    const input = '\\[\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$$');
    expect(result).toContain('\\sum_{i=1}^{n}');
  });

  it('handles fraction inline', () => {
    const input = 'Pecahan \\(\\frac{3}{4}\\) dari total.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('Pecahan $\\frac{3}{4}$ dari total.');
  });

  it('handles multiple inline math in one string', () => {
    const input = 'Nilai \\(a = 5\\) dan \\(b = 3\\), maka \\(a + b = 8\\).';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe('Nilai $a = 5$ dan $b = 3$, maka $a + b = 8$.');
  });

  it('handles mixed inline and block in same response', () => {
    const input = 'Rumus \\(F = ma\\) dikenal sebagai:\n\\[F = m \\cdot a\\]';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$F = ma$');
    expect(result).toContain('$$');
  });

  // ── Markdown must not be touched ───────────────────────────────────────────

  it('does not touch ## headings', () => {
    const input = '## Bab 1\n\nIni penjelasan.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch **bold** text', () => {
    const input = '**Jawaban:** nilai adalah 42.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch *italic* text', () => {
    const input = '*contoh* teks italic.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch markdown lists', () => {
    const input = '- satu\n- dua\n- tiga';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch --- horizontal rule', () => {
    const input = 'Sebelum\n\n---\n\nSesudah';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not touch markdown table', () => {
    const input = '|A|B|\n|---|---|\n|1|2|';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  // ── Code block protection ──────────────────────────────────────────────────

  it('does not convert math inside fenced code block', () => {
    const input = '```python\nprint("\\(hello\\)")\n```';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('does not convert math inside inline code', () => {
    const input = 'Gunakan `\\(x\\)` untuk placeholder.';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('converts math outside code but leaves code untouched', () => {
    const input = 'Rumus \\(E=mc^2\\) contoh kode: `\\(skip\\)`';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('$E=mc^2$');
    expect(result).toContain('`\\(skip\\)`');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('returns empty string unchanged', () => {
    expect(normalizeMathDelimiters('')).toBe('');
  });

  it('returns null unchanged', () => {
    expect(normalizeMathDelimiters(null)).toBe(null);
  });

  it('does not corrupt LaTeX commands inside already-correct $...$', () => {
    const input = '$\\frac{\\sqrt{x}}{\\alpha + \\beta}$';
    const result = normalizeMathDelimiters(input);
    expect(result).toBe(input);
  });

  it('handles mixed markdown and math response correctly', () => {
    const input = '## Contoh\n\n**Diketahui**\n\n\\[\nf(x)=x^2\n\\]\n\nPenjelasan.';
    const result = normalizeMathDelimiters(input);
    expect(result).toContain('## Contoh');
    expect(result).toContain('**Diketahui**');
    expect(result).toContain('$$');
    expect(result).toContain('f(x)=x^2');
    expect(result).toContain('Penjelasan.');
  });
});

// ─── sanitizeUnpairedDelimiters ───────────────────────────────────────────────

describe('sanitizeUnpairedDelimiters', () => {

  it('leaves paired $$ unchanged', () => {
    const input = '$$\nE = mc^2\n$$';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });

  it('removes trailing unpaired $$ at end of string (streaming scenario)', () => {
    const input = 'Rumus energi:\n$$\nE = mc^2';
    const result = sanitizeUnpairedDelimiters(input);
    expect(result).not.toContain('$$');
    expect(result).toContain('E = mc^2');
  });

  it('does NOT strip single $ — leaves inline math safe', () => {
    // Unpaired single $ at stream end is handled by KaTeX throwOnError:false
    const input = 'Nilai $x = 7$ dan $y =';
    const result = sanitizeUnpairedDelimiters(input);
    // Must not corrupt the paired $x = 7$
    expect(result).toContain('$x = 7$');
  });

  it('does not touch ## headings', () => {
    const input = '## Heading\n\nTeks biasa.';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });

  it('does not touch **bold**', () => {
    const input = '**Bold text** here.';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });

  it('does not touch --- horizontal rule', () => {
    const input = 'A\n\n---\n\nB';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(sanitizeUnpairedDelimiters('')).toBe('');
  });

  it('handles string with no math', () => {
    const input = 'Ini adalah teks biasa tanpa rumus.';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });

  it('handles complete block math untouched', () => {
    const input = '$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$';
    expect(sanitizeUnpairedDelimiters(input)).toBe(input);
  });
});
