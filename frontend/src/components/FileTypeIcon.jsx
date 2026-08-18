import {
  Article,
  Description,
  Draft,
  Notes,
  PictureAsPdf,
  PlayCircle,
  Slideshow,
  SmartDisplay,
  TableChart,
} from '@/icons';

const FILE_ICON_MAP = [
  { match: 'YOUTUBE', icon: SmartDisplay, color: 'text-violet' },
  { match: 'PDF', icon: PictureAsPdf, color: 'text-danger' },
  { match: 'DOCX', icon: Description, color: 'text-info' },
  { match: 'PPT', icon: Slideshow, color: 'text-orange' },
  { match: 'XLS', icon: TableChart, color: 'text-success' },
  { match: 'TXT', icon: Notes, color: 'text-text-secondary' },
  { match: 'CSV', icon: Notes, color: 'text-success' },
  { match: 'MARKDOWN', icon: Article, color: 'text-primary-light' },
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
  const Icon = entry ? entry.icon : Draft;
  const colorClass = entry ? entry.color : 'text-text-secondary';
  return <Icon className={`${className} ${colorClass}`} size={size} aria-hidden="true" />;
}
