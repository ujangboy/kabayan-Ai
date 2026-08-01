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

// "1 Agu 2026, 16:48"
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// "16:48" saja
export function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
