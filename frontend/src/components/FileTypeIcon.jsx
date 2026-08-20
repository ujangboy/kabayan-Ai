import { Icon } from '@/components/ui/Icon';
import { ICONS } from '@/lib/icons';

const FILE_ICON_MAP = [
  { match: 'YOUTUBE', icon: ICONS.files.videoPlay, color: 'text-violet' },
  { match: 'PDF', icon: ICONS.files.pdf, color: 'text-danger' },
  { match: 'DOCX', icon: ICONS.files.document, color: 'text-info' },
  { match: 'PPT', icon: ICONS.files.presentation, color: 'text-orange' },
  { match: 'XLS', icon: ICONS.files.spreadsheet, color: 'text-success' },
  { match: 'TXT', icon: ICONS.files.notes, color: 'text-text-secondary' },
  { match: 'CSV', icon: ICONS.files.notes, color: 'text-success' },
  { match: 'MARKDOWN', icon: ICONS.files.article, color: 'text-primary-light' },
];

export const FILE_COLOR_MAP = {
  YOUTUBE: 'text-violet',
  PDF: 'text-danger',
  DOCX: 'text-info',
  PPT: 'text-orange',
  XLS: 'text-success',
  TXT: 'text-text-secondary',
  CSV: 'text-success',
  MARKDOWN: 'text-primary-light',
};

export default function FileTypeIcon({ type, className = '', size }) {
  const t = String(type || '').toUpperCase();
  const entry = FILE_ICON_MAP.find(({ match }) => t.includes(match));
  const icon = entry ? entry.icon : ICONS.files.draft;
  const colorClass = entry ? entry.color : 'text-text-secondary';
  return <Icon name={icon} className={`${className} ${colorClass}`} size={size} aria-hidden="true" />;
}