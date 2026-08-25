import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Tooltip , Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { formatDate } from '@/utils';
import { cn } from '@/utils';
import { springWave } from '@/lib/motion';

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
        'group relative overflow-hidden rounded-xl border transition-colors duration-200',
        isSelected
          ? 'border-primary/40 ring-1 ring-primary/30 bg-primary/5'
          : 'border-transparent hover:border-strong hover:bg-card'
      )}
    >
      {isSelected && (
        <motion.span
          layoutId="notebook-active-indicator"
          transition={springWave}
          className="absolute inset-0 bg-primary/10 rounded-xl pointer-events-none"
        />
      )}
      {isEditing ? (
        <div className="relative z-10 pl-3 pr-24 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            {note.is_pinned && (
              <Icon name={ICONS.actions.pin} size={14} fill={1} className="text-warning shrink-0" />
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
          className="relative z-10 w-full text-left pl-3 pr-24 py-2.5"
        >
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            {note.is_pinned && (
              <Icon name={ICONS.actions.pin} size={14} fill={1} className="text-warning shrink-0" />
            )}
            <Tooltip label={note.title || t('notebook.untitled')}>
              <span className={cn(
                'text-sm font-medium line-clamp-2 break-words whitespace-normal min-w-0 leading-snug',
                isSelected ? 'text-primary-light' : 'text-text'
              )}>
                {note.title || t('notebook.untitled')}
              </span>
            </Tooltip>
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
      <div className="absolute right-1.5 top-2 z-10 hidden group-hover:flex items-center gap-0.5">
          <Tooltip label={t('notebook.rename')}>
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename?.(note); }}
              aria-label={t('notebook.rename')}
              className="p-1.5 rounded-md text-text-muted hover:text-primary transition-colors"
            >
              <Icon name={ICONS.actions.edit} size={14} />
            </button>
          </Tooltip>
        <Tooltip label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              note.is_pinned ? 'text-warning' : 'text-text-muted hover:text-warning'
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