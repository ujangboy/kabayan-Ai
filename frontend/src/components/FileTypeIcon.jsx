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
  { match: 'YOUTUBE', icon: SmartDisplay },
  { match: 'PDF', icon: PictureAsPdf },
  { match: 'DOCX', icon: Description },
  { match: 'PPT', icon: Slideshow },
  { match: 'XLS', icon: TableChart },
  { match: 'TXT', icon: Notes },
  { match: 'CSV', icon: Notes },
  { match: 'MARKDOWN', icon: Article },
];

export default function FileTypeIcon({ type, className = '', size }) {
  const t = String(type || '').toUpperCase();
  const entry = FILE_ICON_MAP.find(({ match }) => t.includes(match));
  const Icon = entry ? entry.icon : Draft;
  return <Icon className={className} size={size} aria-hidden="true" />;
}
