import { useTranslation } from 'react-i18next';

import { Tooltip, Skeleton , Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';
import { NoteCard } from '@/components/notebook/NoteCard';

export function NotebookSidebar({
  isLoading,
  notes,
  filteredNotes,
  pinnedNotes,
  unpinnedNotes,
  selectedNote,
  noteSearch,
  setNoteSearch,
  isCreating,
  onCreateNote,
  onShowGenerate,
  onSelectNote,
  onPin,
  onDelete,
  editingId,
  editingValue,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onStartRename,
  onClearAll,
}) {
  const { t } = useTranslation();

  return (
    <div className="w-72 divider-gradient-r relative bg-subtle flex flex-col shrink-0 h-full min-h-0">
      {/* Sidebar header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{t('notebook.notes')}</h2>
        <div className="flex items-center gap-1">
          <Tooltip label={t('notebook.generateWithAi')}>
            <button
              onClick={onShowGenerate}
              className="p-1.5 rounded-lg transition-all duration-150 text-primary hover:bg-primary/10"
              aria-label={t('notebook.generateWithAi')}
            >
              <Icon name={ICONS.learning.sparkles} size={15} />
            </button>
          </Tooltip>
          <Tooltip label={t('notebook.newNoteTitle')}>
            <button
              onClick={onCreateNote}
              disabled={isCreating}
              className={cn(
                'p-1.5 rounded-lg transition-all duration-150',
                'text-primary hover:bg-primary/10',
                isCreating && 'opacity-50 pointer-events-none'
              )}
              aria-label={t('notebook.newNoteTitle')}
            >
              <Icon name={ICONS.actions.addOutline} size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Icon name={ICONS.actions.search} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
            placeholder="Cari catatan..."
            className="w-full pl-7 pr-7 py-1.5 bg-popover border border-strong rounded-lg text-xs text-text placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
          />
          {noteSearch && (
            <Tooltip label="Bersihkan pencarian">
              <button
                onClick={() => setNoteSearch('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
              >
                <Icon name={ICONS.actions.close} size={11} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Note list */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-2 pb-2 space-y-0.5">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center mb-3">
              <Icon name={ICONS.files.document} size={20} className="text-text-muted" />
            </div>
            <p className="text-xs text-text-muted">{t('notebook.noNotes')}</p>
            <button
              onClick={onCreateNote}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {t('notebook.createNote')}
            </button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name={ICONS.actions.search} size={20} className="text-text-muted mb-2 opacity-50" />
            <p className="text-xs text-text-muted">Tidak ada catatan yang cocok</p>
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <div className="pb-2 mb-2 border-b border-border/50">
                <p className="px-2 pt-2 pb-1 text-3xs font-medium text-text-muted/60 uppercase tracking-wider select-none">
                  {t('notebook.pinned')}
                </p>
                {pinnedNotes.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    isSelected={selectedNote?.id === n.id}
                    onSelect={() => onSelectNote(n)}
                    onPin={() => onPin(n.id)}
                    editingId={editingId}
                    editingValue={editingValue}
                    onEditChange={onEditChange}
                    onEditSubmit={onEditSubmit}
                    onEditCancel={onEditCancel}
                    onStartRename={onStartRename}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <p className="px-2 pt-3 pb-1 text-3xs font-medium text-text-muted/60 uppercase tracking-wider select-none">
                    {t('notebook.notes')}
                  </p>
                )}
                {unpinnedNotes.map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    isSelected={selectedNote?.id === n.id}
                    onSelect={() => onSelectNote(n)}
                    onPin={() => onPin(n.id)}
                    editingId={editingId}
                    editingValue={editingValue}
                    onEditChange={onEditChange}
                    onEditSubmit={onEditSubmit}
                    onEditCancel={onEditCancel}
                    onStartRename={onStartRename}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar footer */}
      {notes.length > 0 && (
        <div className="p-3 border-t border-border">
          <button
            onClick={onClearAll}
            className="w-full text-2xs text-text-muted hover:text-danger transition-colors py-1.5 rounded-lg hover:bg-danger/5"
          >
            {t('notebook.deleteAll')}
          </button>
        </div>
      )}
    </div>
  );
}