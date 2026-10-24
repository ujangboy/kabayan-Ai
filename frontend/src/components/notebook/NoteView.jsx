import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { notesAPI } from '@/services/api';
import NoteEditor, { VerticalToolbar } from '@/components/NoteEditor';
import { Tooltip , Icon } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils';
import { cn } from '@/utils';

export function NoteView({ note, onBack, onSave, onPin, onDelete }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(note.title || '');
  const [showMenu, setShowMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [mode, setMode] = useState('edit');
  const [editorRef, setEditorRef] = useState(null);
  const titleRef = useRef(null);
  const saveTimerRef = useRef(null);

  const autoResizeTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  useEffect(() => { autoResizeTitle(); }, [title]);
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

  // Sisipkan rumus dari rail vertikal (menggunakan instance editor Tiptap).
  const handleInsertMathFromRail = useCallback(() => {
    if (!editorRef) return;
    const latex = prompt(t('noteEditor.mathPrompt'), 'E = mc^2');
    if (latex !== null && latex.trim()) {
      editorRef.chain().focus().insertMathInline(latex.trim()).run();
    }
  }, [editorRef, t]);

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-strong/50 relative shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors md:hidden"
          >
            <Icon name={ICONS.ui.chevronLeft} size={18} />
          </button>
          <button
            onClick={onBack}
            className="hidden md:flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded-lg hover:bg-card"
          >
            <Icon name={ICONS.ui.chevronLeft} size={14} />
            <span>{t('common.back')}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Auto-save status */}
          <span className={cn(
            'text-3xs flex items-center gap-1 transition-colors px-2',
            saveStatus === 'saving' && 'text-warning',
            saveStatus === 'saved' && 'text-success/70',
          )}>
            {saveStatus === 'saving' && <><span className="animate-pulse">●</span> {t('notebook.saving')}</>}
            {saveStatus === 'saved' && <><Icon name={ICONS.actions.save} size={10} /> {t('notebook.saved')}</>}
          </span>

          {/* Toggle mode: mata (preview) / edit — bersebelahan dengan Tersimpan */}
          <Tooltip label={mode === 'view' ? t('noteEditor.editNote') : t('noteEditor.readMode')}>
            <button
              onClick={() => setMode((m) => (m === 'view' ? 'edit' : 'view'))}
              aria-label={mode === 'view' ? t('notebook.edit') : t('notebook.preview')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                mode === 'view' ? 'text-primary' : 'text-text-muted hover:text-text'
              )}
            >
              <Icon name={mode === 'view' ? ICONS.actions.edit : ICONS.ui.eye} size={15} />
            </button>
          </Tooltip>

          <Tooltip label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
            <button
              onClick={onPin}
              aria-label={note.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                note.is_pinned ? 'text-warning' : 'text-text-muted hover:text-warning'
              )}
            >
              <Icon name={ICONS.actions.pin} size={16} fill={note.is_pinned ? 1 : 0} />
            </button>
          </Tooltip>

          <div className="relative">
            <Tooltip label="Opsi lainnya">
              <button
                onClick={() => setShowMenu(v => !v)}
                aria-label="Opsi lainnya"
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors"
              >
                <Icon name={ICONS.actions.more} size={15} />
              </button>
            </Tooltip>
            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="fixed inset-0 z-30"
                    onClick={() => setShowMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute right-0 top-full mt-1 z-40 bg-popover border border-strong rounded-xl shadow-xl py-1 min-w-[140px] origin-top-right"
                  >
                    <button
                      onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger/5 transition-colors"
                    >
                      {t('notebook.deleteNote')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Paper — Samsung Notes style sheet (kertas) + rail vertikal kanan (di luar kertas) */}
      <div className="flex-1 min-h-0 p-3 flex gap-3 justify-center">
        <div className="w-full max-w-[860px] h-full bg-surface border border-border rounded-xl shadow-card flex flex-col overflow-hidden">
          {/* Title */}
          <div className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-4 shrink-0">
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onInput={autoResizeTitle}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="w-full text-3xl font-medium tracking-headline text-text bg-transparent outline-none resize-none overflow-y-auto break-words whitespace-pre-wrap leading-tight placeholder:text-text-muted/40 min-h-[36px] max-h-[120px]"
              placeholder={t('notebook.noteTitlePlaceholder')}
            />
            <div className="flex items-center gap-2 mt-1.5 text-2xs text-text-muted/60">
              {note.subject && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  {note.subject.name}
                </span>
              )}
              {note.subject && <span>·</span>}
              <Tooltip label={formatDateTime(note.created_at)}>
                <span>{formatDate(note.created_at)}</span>
              </Tooltip>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <NoteEditor
              key={note.id}
              noteId={note.id}
              content={note.content}
              onSave={handleContentSave}
              defaultMode="edit"
              mode={mode}
              onModeChange={setMode}
              onEditorReady={setEditorRef}
            />
          </div>
        </div>

        {/* Rail vertikal kanan — hanya desktop, di luar kertas.
            Saat mode view, cadangkan lebar rail (spacer) agar kertas tidak
            bergeser/"snap" saat toggle edit <-> view. */}
        <div className="shrink-0">
          {mode === 'edit' && editorRef ? (
            <VerticalToolbar
              editor={editorRef}
              onPreview={() => setMode('view')}
              onInsertMath={handleInsertMathFromRail}
            />
          ) : (
            <div className="w-[46px] my-3 h-full" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}