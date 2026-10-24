import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge default hanya kenal ukuran font bawaan Tailwind (xs–4xl).
 * Token kustom dari tailwind.config.js (15, meta, 2xs, 3xs) jatuh ke grup
 * "text-color" → `cn('... text-white ...', 'text-15')` akan MEMBUANG
 * text-white (kasus nyata: teks tombol solid pandan jadi gelap di light mode).
 * Daftarkan di sini supaya selalu diperlakukan sebagai font-size.
 */
const CUSTOM_FONT_SIZES = ["15", "meta", "2xs", "3xs"];

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: CUSTOM_FONT_SIZES }],
    },
  },
});

export function cn(...inputs) {
  return customTwMerge(clsx(inputs));
}

// ─── Motion tokens (DESIGN.md §7) ──────────────────────────────────────────
// Satu sumber kebenaran untuk durasi/easing framer-motion agar konsisten.
// Durasi pendek (0.15–0.35s) + ease khas "springy ease-out" dari design system.
export const EASE = [0.32, 0.72, 0, 1];
export const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

export const fadeSlide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: EASE },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASE },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
  transition: { duration: 0.22, ease: EASE },
};

// Variants untuk list/grid stagger (container + item)
export const staggerContainer = (stagger = 0.04, delayChildren = 0) => ({
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE } },
};

// Ikuti bahasa aktif agar format tanggal konsisten dengan UI (id/en/su).
function activeLocale() {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang;
    if (lang === 'en') return 'en-US';
    if (lang === 'su') return 'su-ID';
  }
  return 'id-ID';
}

// Pastikan string UTC ditambah 'Z' agar browser konversi ke local time dengan benar
function toLocalDate(dateStr) {
  if (!dateStr) return null;
  // Jika belum ada timezone info (tidak ada Z atau +/-), anggap UTC
  const s = String(dateStr);
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(s) ? s : s + 'Z';
  return new Date(normalized);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return toLocalDate(dateStr).toLocaleDateString(activeLocale(), {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// "1 Agu 2026, 16:48"
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = toLocalDate(dateStr);
  const date = d.toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// "16:48" saja
export function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  return toLocalDate(dateStr).toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' });
}

// "1.5 MB" — satu sumber kebenaran untuk tampilan ukuran file/storage
export function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
