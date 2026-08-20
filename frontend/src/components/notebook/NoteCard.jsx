import { useTranslation } from 'react-i18next';
import { Pin, Trash2 } from '@/icons';
import { Tooltip } from '@/components/ui';
import { formatDate } from '@/utils';
import { cn } from '@/utils';

export function NoteCard({ note, isSelected, onSelect, onPin, onDelete }) {
  const { t } = useTranslation();
  const snippet = (note.content || '')
    .replace(/<[^>]+>/g, '')
    .replace(/#+\s/g, '')
    .replace(/\*+/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 80);

  return (
    <div
      className={cn(
        'group relative rounded-xl transition-all duration-200',
        isSelected
          ? 'bg-gradient-primary-soft ring-1 ring-primary/30'
          : 'hover:bg-card/80'
      )}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {note.is_pinned && <Pin size={9} className="text-primary shrink-0" />}
          <span className={cn(
            'text-sm font-medium truncate',
            isSelected ? 'text-primary-light' : 'text-text'
          )}>
            {note.title || t('notebook.untitled')}
          </span>
        </div>
        {snippet && (
          <p className="text-[11px] text-text-muted line-clamp-1 leading-relaxed mb-1">
            {snippet}
          </p>
        )}
        <span className="text-[10px] text-text-muted/70">
          {formatDate(note.created_at)}
        </span>
      </button>

      {/* Hover actions */}
      <div className="absolute right-1.5 top-2 hidden group-hover:flex items-center gap-0.5">
        <Tooltip label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
            className={cn(
              'p-1 rounded-md transition-colors',
              note.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
            )}
          >
            <Pin size={11} />
          </button>
        </Tooltip>
        <Tooltip label={t('common.delete')}>
          <button
            onClick={(e) => onDelete(note.id, e)}
            aria-label={t('common.delete')}
            className="p-1 rounded-md text-text-muted hover:text-danger transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
