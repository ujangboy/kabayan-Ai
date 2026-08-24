import { useTranslation } from 'react-i18next';

import { Tooltip , Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { formatDate } from '@/utils';
import { cn } from '@/utils';

export function NoteCard({
  note, isSelected, onSelect, onPin, onDelete,
  editingId, editingValue, onEditChange, onEditSubmit, onEditCancel, onStartRename,
}) {
  const { t } = useTranslation();
  const isEditing = editingId === note.id;
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
          ? 'bg-primary-soft ring-1 ring-primary/30'
          : 'hover:bg-card/80'
      )}
    >
      {isEditing ? (
        <div className="pl-3 pr-24 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            {note.is_pinned && (
              <Icon name={ICONS.actions.pin} size={14} fill={1} className="text-primary shrink-0" />
            )}
            <input
              autoFocus
              value={editingValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSubmit();
                if (e.key === 'Escape') onEditCancel();
              }}
              className="min-w-0 flex-1 text-sm font-medium text-text bg-background border border-primary/50 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={onSelect}
          className="w-full text-left pl-3 pr-24 py-2.5"
        >
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            {note.is_pinned && (
              <Icon name={ICONS.actions.pin} size={14} fill={1} className="text-primary shrink-0" />
            )}
            <span className={cn(
              'text-sm font-medium truncate min-w-0',
              isSelected ? 'text-primary-light' : 'text-text'
            )} title={note.title || t('notebook.untitled')}>
              {note.title || t('notebook.untitled')}
            </span>
          </div>
          {snippet && (
            <p className="text-2xs text-text-muted line-clamp-1 leading-relaxed mb-1">
              {snippet}
            </p>
          )}
          <span className="text-3xs text-text-muted/70">
            {formatDate(note.created_at)}
          </span>
        </button>
      )}

      {/* Hover actions */}
      <div className="absolute right-1.5 top-2 hidden group-hover:flex items-center gap-0.5">
        <Tooltip label={t('notebook.rename')}>
          <button
            onClick={(e) => { e.stopPropagation(); onStartRename?.(note); }}
            aria-label={t('notebook.rename')}
            className="p-1.5 rounded-md text-text-muted hover:text-primary transition-colors"
          >
            <Icon name={ICONS.actions.editNote} size={14} />
          </button>
        </Tooltip>
        <Tooltip label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              note.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
            )}
          >
            <Icon name={ICONS.actions.pin} size={14} fill={note.is_pinned ? 1 : 0} />
          </button>
        </Tooltip>
        <Tooltip label={t('common.delete')}>
          <button
            onClick={(e) => onDelete(note.id, e)}
            aria-label={t('common.delete')}
            className="p-1.5 rounded-md text-text-muted hover:text-danger transition-colors"
          >
            <Icon name={ICONS.actions.delete} size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}