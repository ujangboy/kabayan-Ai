import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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
  return toLocalDate(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// "1 Agu 2026, 16:48"
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = toLocalDate(dateStr);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// "16:48" saja
export function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  return toLocalDate(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
