import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, Save, Pin, MoreHorizontal } from '@/icons';
import { notesAPI } from '@/services/api';
import NoteEditor from '@/components/NoteEditor';
import { Tooltip } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils';
import { cn } from '@/utils';

export function NoteView({ note, onBack, onSave, onPin, onDelete }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(note.title || '');
  const [showMenu, setShowMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const titleRef = useRef(null);
  const saveTimerRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const renameMutation = useMutation({
    mutationFn: ({ id, title }) => notesAPI.rename(id, title),
    onSuccess: () => queryClient.invalidateQueries(['notes']),
  });

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== note.title) {
      renameMutation.mutate({ id: note.id, title: trimmed });
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef.current?.blur();
    }
  };

  const handleContentSave = useCallback((html) => {
    setSaveStatus('saving');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave(html);
      setSaveStatus('saved');
    }, 300);
  }, [onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 py-2 divider-gradient-b relative shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors md:hidden"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onBack}
            className="hidden md:flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded-lg hover:bg-card"
          >
            <ChevronLeft size={14} />
            <span>{t('common.back')}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto-save status */}
          <span className={cn(
            'text-[10px] flex items-center gap-1 transition-colors px-2',
            saveStatus === 'saving' && 'text-warning',
            saveStatus === 'saved' && 'text-success/70',
          )}>
            {saveStatus === 'saving' && <><span className="animate-pulse">●</span> {t('notebook.saving')}</>}
            {saveStatus === 'saved' && <><Save size={10} /> {t('notebook.saved')}</>}
          </span>

          <Tooltip label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
            <button
              onClick={onPin}
              aria-label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                note.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
              )}
            >
              <Pin size={15} />
            </button>
          </Tooltip>

          <div className="relative">
            <Tooltip label="Opsi lainnya">
              <button
                onClick={() => setShowMenu(v => !v)}
                aria-label="Opsi lainnya"
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors"
              >
                <MoreHorizontal size={15} />
              </button>
            </Tooltip>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger/5 transition-colors"
                  >
                    {t('notebook.deleteNote')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-8 md:px-16 lg:px-24 pt-6 pb-2 shrink-0">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="w-full text-2xl font-bold text-text bg-transparent outline-none placeholder:text-text-muted/40"
          placeholder={t('notebook.noteTitlePlaceholder')}
        />
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-muted/60">
          {note.subject && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              {note.subject.name}
            </span>
          )}
          {note.subject && <span>·</span>}
          <span title={formatDateTime(note.created_at)}>{formatDate(note.created_at)}</span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <NoteEditor
          key={note.id}
          noteId={note.id}
          content={note.content}
          onSave={handleContentSave}
          defaultMode="edit"
        />
      </div>
    </div>
  );
}
