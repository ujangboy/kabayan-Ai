/**
 * FileTypeIcon — glyph khas tipe file: lembar kertas bersudut tekuk dengan
 * label huruf tipe (PDF/DOC/XLS/PPT/YT/...). SVG custom, bukan Material
 * Symbols — bentuknya lebih lembut dan tidak kaku, warna ikut token kategori
 * (currentColor) sehingga tetap konsisten dengan tint chip di sekitarnya.
 */
const FILE_TYPES = [
  { match: 'YOUTUBE', label: 'YT', color: 'text-accent-purple' },
  { match: 'PDF', label: 'PDF', color: 'text-danger' },
  { match: 'DOCX', label: 'DOC', color: 'text-info' },
  { match: 'PPT', label: 'PPT', color: 'text-warning' },
  { match: 'XLS', label: 'XLS', color: 'text-success' },
  { match: 'TXT', label: 'TXT', color: 'text-text-secondary' },
  { match: 'CSV', label: 'CSV', color: 'text-success' },
  { match: 'MARKDOWN', label: 'MD', color: 'text-primary-light' },
];

export const FILE_COLOR_MAP = {
  YOUTUBE: 'text-accent-purple',
  PDF: 'text-danger',
  DOCX: 'text-info',
  PPT: 'text-warning',
  XLS: 'text-success',
  TXT: 'text-text-secondary',
  CSV: 'text-success',
  MARKDOWN: 'text-primary-light',
};

export default function FileTypeIcon({ type, className = '', size }) {
  const t = String(type || '').toUpperCase();
  const entry = FILE_TYPES.find(({ match }) => t.includes(match));
  const label = entry ? entry.label : null;
  const colorClass = entry ? entry.color : 'text-text-secondary';
  const dim = size ?? 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      className={`select-none ${className} ${colorClass}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Badan lembar dengan sudut tekuk */}
      <path
        d="M7.5 3h6.75l4.75 4.75V19a3 3 0 0 1-3 3H7.5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Lipatan sudut kanan-atas */}
      <path d="M14.25 3v4.75h4.75" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {label ? (
        <text
          x="12"
          y="17.4"
          textAnchor="middle"
          fontSize="6"
          fontWeight="800"
          letterSpacing="0.35"
          fill="currentColor"
        >
          {label}
        </text>
      ) : (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
          <path d="M8.5 14.5h7" />
          <path d="M8.5 17.5h4.5" />
        </g>
      )}
    </svg>
  );
}
