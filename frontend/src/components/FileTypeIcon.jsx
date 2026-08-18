import {
  MdArticle, MdDescription, MdInsertDriveFile, MdNotes, MdOndemandVideo,
  MdPictureAsPdf, MdSlideshow, MdSmartDisplay, MdTableChart,
} from 'react-icons/md';

const FILE_ICON_MAP = [
  { match: 'YOUTUBE', icon: MdSmartDisplay },
  { match: 'PDF', icon: MdPictureAsPdf },
  { match: 'DOCX', icon: MdDescription },
  { match: 'PPT', icon: MdSlideshow },
  { match: 'XLS', icon: MdTableChart },
  { match: 'TXT', icon: MdNotes },
  { match: 'CSV', icon: MdNotes },
  { match: 'MARKDOWN', icon: MdArticle },
];

export default function FileTypeIcon({ type, className = '', size }) {
  const t = String(type || '').toUpperCase();
  const entry = FILE_ICON_MAP.find(({ match }) => t.includes(match));
  const Icon = entry ? entry.icon : MdInsertDriveFile;
  return <Icon className={className} size={size} aria-hidden="true" />;
}