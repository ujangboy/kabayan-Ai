import { cn } from '@/utils';

// 10 warna berbeda untuk badge mata kuliah. Warna ditentukan dari hash nama,
// sehingga nama yang sama selalu dapat warna sama (konsisten antar halaman),
// dan nama berbeda dapat warna yang berbeda.
const PALETTE = [
  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'bg-teal-500/15 text-teal-300 border-teal-500/30',
  'bg-pink-500/15 text-pink-300 border-pink-500/30',
  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
];

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

export function getSubjectColorIndex(name) {
  return hashString(name || '') % PALETTE.length;
}

export function SubjectBadge({ name, className, size = 'md', tone }) {
  const idx = tone != null ? ((tone % PALETTE.length) + PALETTE.length) % PALETTE.length : getSubjectColorIndex(name);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-xl border font-bold uppercase shrink-0 select-none',
        PALETTE[idx],
        size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm',
        className
      )}
    >
      {getSubjectInitials(name)}
    </span>
  );
}