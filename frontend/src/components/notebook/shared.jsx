// ─── Auto-title: extract title from content (zero AI) ─────────────────────
export function extractTitle(content) {
  if (!content) return '';
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\$[^\$\n]+?\$/g, ' ')
    .trim();
  if (!text) return '';

  // 1) Heading: # Title
  const headingMatch = text.match(/^#{1,3}\s+(.+)/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 80);

  // 2) First sentence (ends with . ! ?)
  const sentenceMatch = text.match(/^(.+?[.!?])\s/m);
  if (sentenceMatch) return sentenceMatch[1].trim().slice(0, 80);

  // 3) First line
  const firstLine = text.split('\n')[0].trim();
  return firstLine.slice(0, 80);
}

// ─── Placeholder title generator ──────────────────────────────────────────
export function nextPlaceholderTitle(notes, base) {
  const existing = new Set(notes.map(n => (n.title || '').toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let i = 2;
  while (existing.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}