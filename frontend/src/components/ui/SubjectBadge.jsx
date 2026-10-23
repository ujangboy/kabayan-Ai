import { cn } from '@/utils';

/**
 * 5 warna kartu per mata kuliah — dipilih dari subject_id (identik di semua
 * halaman lama/baru: badge, folder, kartu materi, deck flashcard, quiz).
 * Frontend-only, deterministik: (subject_id - 1) % 5. Tanpa kolom DB.
 * Token berbasis accent data-viz agar mittel tone di light & dark.
 *
 * `card` menintai seluruh badan kartu (bukan hanya badge): border + wash
 * tipis yang tetap terbaca di light/dark, dengan `bar` sebagai aksen atas.
 */
const PALETTE = [
  {
    id: 'teal',
    badge: 'bg-accent-teal/12 border-accent-teal/30 text-accent-teal',
    card: 'border-accent-teal/30 bg-accent-teal/5 hover:border-accent-teal/45',
    bar: 'bg-accent-teal',
    icon: 'text-accent-teal',
  },
  {
    id: 'blue',
    badge: 'bg-accent-blue/12 border-accent-blue/30 text-accent-blue',
    card: 'border-accent-blue/30 bg-accent-blue/5 hover:border-accent-blue/45',
    bar: 'bg-accent-blue',
    icon: 'text-accent-blue',
  },
  {
    id: 'purple',
    badge: 'bg-accent-purple/12 border-accent-purple/30 text-accent-purple',
    card: 'border-accent-purple/30 bg-accent-purple/5 hover:border-accent-purple/45',
    bar: 'bg-accent-purple',
    icon: 'text-accent-purple',
  },
  {
    id: 'pink',
    badge: 'bg-accent-pink/12 border-accent-pink/30 text-accent-pink',
    card: 'border-accent-pink/30 bg-accent-pink/5 hover:border-accent-pink/45',
    bar: 'bg-accent-pink',
    icon: 'text-accent-pink',
  },
  {
    id: 'sun',
    badge: 'bg-sun/12 border-sun/30 text-sun',
    card: 'border-sun/30 bg-sun/5 hover:border-sun/45',
    bar: 'bg-sun',
    icon: 'text-sun',
  },
];

export function getSubjectPalette(subjectId) {
  const n = Number(subjectId);
  const idx = Number.isFinite(n) && n > 0 ? (n - 1) % PALETTE.length : -1;
  return idx >= 0 ? PALETTE[idx] : null;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getSubjectInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Fallback tanpa subject_id: hash nama → warna yang stabil antar halaman. */
export function getSubjectColorIndex(name) {
  return hashString(name || '') % PALETTE.length;
}

export function getSubjectPaletteIndex({ subjectId, tone, name } = {}) {
  if (subjectId != null && Number.isFinite(Number(subjectId)) && Number(subjectId) > 0) {
    return (Number(subjectId) - 1) % PALETTE.length;
  }
  if (tone != null) return ((Number(tone) % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return getSubjectColorIndex(name);
}

const TONE_INDEX = {
  teal: 0,
  green: 0,
  success: 0,
  blue: 1,
  info: 1,
  purple: 2,
  primary: 2,
  pink: 3,
  rose: 3,
  sun: 4,
  warning: 4,
};

/** Palet kartu untuk tone semantik (dipakai Dashboard/Settings). */
export function getCardTone(tone) {
  if (typeof tone === 'number') {
    return PALETTE[((tone % PALETTE.length) + PALETTE.length) % PALETTE.length];
  }
  return PALETTE[TONE_INDEX[String(tone || '').toLowerCase()] ?? 0];
}

export function SubjectBadge({ name, className, size = 'md', tone, subjectId }) {
  const idx = getSubjectPaletteIndex({ subjectId, tone, name });
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-xl border font-bold uppercase shrink-0 select-none',
        PALETTE[idx].badge,
        size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm',
        className
      )}
    >
      {getSubjectInitials(name)}
    </span>
  );
}
