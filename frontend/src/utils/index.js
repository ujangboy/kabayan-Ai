import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function fileIcon(type) {
  const t = (type || '').toUpperCase();
  if (t.includes('YOUTUBE')) return '🎬';
  if (t.includes('PDF')) return '📄';
  if (t.includes('DOCX')) return '📝';
  if (t.includes('PPT')) return '📊';
  if (t.includes('TXT')) return '🗒️';
  return '📁';
}
