import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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
