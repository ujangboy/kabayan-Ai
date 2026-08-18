import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, Pin, Save, ChevronLeft, MoreHorizontal, Sparkles, X, Search, RefreshCw } from '@/icons';
import { notesAPI, subjectAPI } from '@/services/api';
import { formatDate, formatDateTime } from '@/utils';
import { cn } from '@/utils';
import NoteEditor from '@/components/NoteEditor';
import MaterialPicker from '@/components/MaterialPicker';
import { Tooltip } from '@/components/ui/Tooltip';

// ─── Auto-title: extract title from content (zero AI) ─────────────────────
function extractTitle(content) {
  if (!content) return '';
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\$[^\$\n]+?\$/g, ' ')
    .trim();
  if (!text) return '';

  // 1) Heading: # Title
  const headingMatch = text.match(/^#{1,3}\s+(.+)/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 80);

  // 2) First sentence (ends with . ! ?)
  const sentenceMatch = text.match(/^(.+?[.!?])\s/m);
  if (sentenceMatch) return sentenceMatch[1].trim().slice(0, 80);

  // 3) First line
  const firstLine = text.split('\n')[0].trim();
  return firstLine.slice(0, 80);
}

// ─── Placeholder title generator ──────────────────────────────────────────
function nextPlaceholderTitle(notes, base) {
  const existing = new Set(notes.map(n => (n.title || '').toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let i = 2;
  while (existing.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}

export default function NotebookPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const createMutexRef = useRef(false);
  // Refs to avoid stale closures in callbacks
  const rawNotesRef = useRef([]);
  const notesRef = useRef([]);
  const renameMutateRef = useRef(null);

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesAPI.getAll().then(r => r.data),
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data),
  });

  const rawNotes = notesData?.notes || [];
  const subjects = subjectData?.subjects || [];

  const notes = [...rawNotes].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Sync refs every render
  rawNotesRef.current = rawNotes;
  notesRef.current = notes;

  const searchQuery = noteSearch.trim().toLowerCase();
  const filteredNotes = searchQuery
    ? notes.filter(n =>
        (n.title || '').toLowerCase().includes(searchQuery) ||
        (n.content || '').replace(/<[^>]+>/g, ' ').toLowerCase().includes(searchQuery)
      )
    : notes;

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.is_pinned);

  const deleteMutation = useMutation({
    mutationFn: (id) => notesAPI.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['notes']);
      if (selectedNote?.id === id) setSelectedNote(null);
    },
  });

  const pinMutation = useMutation({
    mutationFn: (id) => notesAPI.togglePin(id),
    onSuccess: () => queryClient.invalidateQueries(['notes']),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }) => notesAPI.rename(id, title),
    onSuccess: (_, { id, title }) => {
      queryClient.invalidateQueries(['notes']);
      if (selectedNote?.id === id) {
        setSelectedNote(prev => ({ ...prev, title }));
      }
    },
  });

  // Keep ref in sync so callbacks don't need it as a dependency
  renameMutateRef.current = renameMutation.mutate;

  const updateContentMutation = useMutation({
    mutationFn: ({ id, content }) => notesAPI.updateContent(id, content),
    onSuccess: (_, { id, content }) => {
      queryClient.invalidateQueries(['notes']);
      if (selectedNote?.id === id) {
        setSelectedNote(prev => (prev ? { ...prev, content } : prev));
      }
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => notesAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setSelectedNote(null);
    },
  });

  // ── Instant note creation ──────────────────────────────────────────────
  const handleCreateNote = useCallback(async () => {
    if (createMutexRef.current) return;
    createMutexRef.current = true;
    setIsCreating(true);
    try {
      const title = nextPlaceholderTitle(notesRef.current, t('notebook.newNoteTitle'));
      const res = await notesAPI.create(title, '');
      const noteId = res.data?.note_id;
      queryClient.invalidateQueries(['notes']);
      if (noteId) {
        const listRes = await notesAPI.getAll();
        const allNotes = listRes.data?.notes || [];
        const newNote = allNotes.find(n => n.id === noteId);
        if (newNote) setSelectedNote(newNote);
      }
    } catch (err) {
      console.error('Gagal membuat catatan:', err);
    } finally {
      setIsCreating(false);
      createMutexRef.current = false;
    }
  }, [queryClient, t]);

  // ── Auto-title from content ────────────────────────────────────────────
  const handleAutoTitle = useCallback((noteId, content) => {
    const note = rawNotesRef.current.find(n => n.id === noteId);
    if (!note) return;

    // Only auto-update if title is a placeholder
    const baseTitle = t('notebook.newNoteTitle');
    const placeholderPattern = new RegExp('^' + baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s\\d+)?$', 'i');
    if (!placeholderPattern.test(note.title || '')) return;

    const newTitle = extractTitle(content);
    if (newTitle && newTitle !== note.title) {
      renameMutateRef.current?.({ id: noteId, title: newTitle });
    }
  }, [t]);

  // ── Content save (debounced) ───────────────────────────────────────────
  const handleContentSave = useCallback((html) => {
    if (!selectedNote) return;
    updateContentMutation.mutate({ id: selectedNote.id, content: html });
    handleAutoTitle(selectedNote.id, html);
  }, [selectedNote, updateContentMutation, handleAutoTitle]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm(t('notebook.confirmDeleteNote'))) deleteMutation.mutate(id);
  };

  const handleClearAll = () => {
    if (confirm(t('notebook.confirmClearAll'))) clearMutation.mutate();
  };

  // ── Note card ──────────────────────────────────────────────────────────
  const renderNoteCard = (n) => {
    const snippet = (n.content || '')
      .replace(/<[^>]+>/g, '')
      .replace(/#+\s/g, '')
      .replace(/\*+/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 80);

    const isSelected = selectedNote?.id === n.id;

    return (
      <div
        key={n.id}
        className={cn(
          'group relative rounded-xl transition-all duration-150',
          isSelected
            ? 'bg-primary/10 ring-1 ring-primary/20'
            : 'hover:bg-card/80'
        )}
      >
        <button
          onClick={() => setSelectedNote(n)}
          className="w-full text-left px-3 py-2.5"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {n.is_pinned && <Pin size={9} className="text-primary shrink-0" />}
            <span className={cn(
              'text-sm font-medium truncate',
              isSelected ? 'text-primary' : 'text-text'
            )}>
              {n.title || t('notebook.untitled')}
            </span>
          </div>
          {snippet && (
            <p className="text-[11px] text-text-muted line-clamp-1 leading-relaxed mb-1">
              {snippet}
            </p>
          )}
          <span className="text-[10px] text-text-muted/70">
            {formatDate(n.created_at)}
          </span>
        </button>

        {/* Hover actions */}
        <div className="absolute right-1.5 top-2 hidden group-hover:flex items-center gap-0.5">
          <Tooltip label={n.is_pinned ? t('notebook.unpin') : t('notebook.pin')}>
            <button
              onClick={(e) => { e.stopPropagation(); pinMutation.mutate(n.id); }}
              aria-label={n.is_pinned ? t('notebook.unpin') : t('notebook.pin')}
              className={cn(
                'p-1 rounded-md transition-colors',
                n.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
              )}
            >
              <Pin size={11} />
            </button>
          </Tooltip>
          <Tooltip label={t('common.delete')}>
            <button
              onClick={(e) => handleDelete(n.id, e)}
              aria-label={t('common.delete')}
              className="p-1 rounded-md text-text-muted hover:text-danger transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ═══ Sidebar ═══ */}
      <div className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0 hidden md:flex">
        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{t('notebook.notes')}</h2>
          <div className="flex items-center gap-1">
            <Tooltip label={t('notebook.generateWithAi')}>
              <button
                onClick={() => setShowGeneratePanel(true)}
                className="p-1.5 rounded-lg transition-all duration-150 text-primary hover:bg-primary/10"
                aria-label={t('notebook.generateWithAi')}
              >
                <Sparkles size={15} />
              </button>
            </Tooltip>
            <Tooltip label={t('notebook.newNoteTitle')}>
              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-150',
                  'text-primary hover:bg-primary/10',
                  isCreating && 'opacity-50 pointer-events-none'
                )}
                aria-label={t('notebook.newNoteTitle')}
              >
                <Plus size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder="Cari catatan..."
              className="w-full pl-7 pr-7 py-1.5 bg-background border border-border rounded-lg text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
            {noteSearch && (
              <Tooltip label="Bersihkan pencarian">
                <button
                  onClick={() => setNoteSearch('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                >
                  <X size={11} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {isLoading ? (
            <p className="text-text-muted text-xs p-3 text-center">{t('common.loading')}</p>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center mb-3">
                <FileText size={20} className="text-text-muted" />
              </div>
              <p className="text-xs text-text-muted">{t('notebook.noNotes')}</p>
              <button
                onClick={handleCreateNote}
                className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {t('notebook.createNote')}
              </button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={20} className="text-text-muted mb-2 opacity-50" />
              <p className="text-xs text-text-muted">Tidak ada catatan yang cocok</p>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider select-none">
                    {t('notebook.pinned')}
                  </p>
                  {pinnedNotes.map(renderNoteCard)}
                </div>
              )}
              {unpinnedNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <p className="px-2 pt-3 pb-1 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider select-none">
                      {t('notebook.notes')}
                    </p>
                  )}
                  {unpinnedNotes.map(renderNoteCard)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar footer */}
        {notes.length > 0 && (
          <div className="p-3 border-t border-border">
            <button
              onClick={handleClearAll}
              className="w-full text-[11px] text-text-muted hover:text-danger transition-colors py-1.5 rounded-lg hover:bg-danger/5"
            >
              {t('notebook.deleteAll')}
            </button>
          </div>
        )}
      </div>

      {/* ═══ Main content ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
          <NoteView
            key={selectedNote.id}
            note={selectedNote}
            onBack={() => setSelectedNote(null)}
            onSave={handleContentSave}
            onPin={() => pinMutation.mutate(selectedNote.id)}
            onDelete={() => {
              if (confirm(t('notebook.confirmDeleteNote'))) deleteMutation.mutate(selectedNote.id);
            }}
          />
        ) : (
          <EmptyState onCreate={handleCreateNote} isCreating={isCreating} />
        )}
      </div>

      {/* ═══ Generate Panel (slide from right) ═══ */}
      <AnimatePresence>
        {showGeneratePanel && (
          <GeneratePanel
            subjects={subjects}
            onClose={() => setShowGeneratePanel(false)}
            onNoteCreated={(note) => {
              setShowGeneratePanel(false);
              queryClient.invalidateQueries(['notes']);
              setSelectedNote(note);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Note view (editor + minimal header) ──────────────────────────────────
function NoteView({ note, onBack, onSave, onPin, onDelete }) {
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
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

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ onCreate, isCreating }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
        <FileText size={28} className="text-text-muted/40" />
      </div>
      <h2 className="text-base font-semibold text-text mb-1">{t('notebook.emptyTitle')}</h2>
      <p className="text-xs text-text-muted mb-5 max-w-[240px] leading-relaxed">
        {t('notebook.emptyDescription')}
      </p>
      <button
        onClick={onCreate}
        disabled={isCreating}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          'bg-primary text-white hover:bg-primary/90 shadow-sm',
          isCreating && 'opacity-50 pointer-events-none'
        )}
      >
        <Plus size={15} />
        {isCreating ? t('notebook.creating') : t('notebook.newNoteTitle')}
      </button>
    </div>
  );
}

// ─── Generate Panel (slide from right) ─────────────────────────────────────
function GeneratePanel({ subjects, onClose, onNoteCreated }) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  const handleGenerate = async () => {
    if (!subjectId) { setError(t('notebook.selectSubjectError')); return; }
    if (selectedMaterialIds.length === 0) { setError(t('notebook.selectMaterialError')); return; }

    setError('');
    setIsGenerating(true);
    try {
      const payload = {
        subject_id: Number(subjectId),
        material_ids: selectedMaterialIds.join(','),
      };
      // Topic is sent as context for AI, NOT as the note title
      if (topic.trim()) payload.title = topic.trim().slice(0, 80);

      const res = await notesAPI.generate(payload);
      const result = res.data;

      // Title comes from AI-generated content (extracted by backend)
      const noteTitle = result.title || t('notebook.aiNoteTitle');

      // Save the generated note to DB
      const saveRes = await notesAPI.create(
        noteTitle,
        result.content || '',
        Number(subjectId)
      );
      const noteId = saveRes.data?.note_id;

      if (!noteId) {
        setError(t('notebook.generateLoadError'));
        return;
      }

      // Fetch full note object and pass back
      const listRes = await notesAPI.getAll();
      const allNotes = listRes.data?.notes || [];
      const newNote = allNotes.find(n => n.id === noteId);
      if (newNote) {
        onNoteCreated(newNote);
      } else {
        // Fallback: construct note from what we have
        onNoteCreated({
          id: noteId,
          title: result.title || topic.trim() || t('notebook.aiNoteTitle'),
          content: result.content || '',
          created_at: new Date().toISOString(),
          is_pinned: false,
          subject: subjects.find(s => s.id === Number(subjectId)) || null,
        });
      }
    } catch (err) {
      setError(err.message || t('notebook.generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-sidebar border-l border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h3 className="font-semibold text-text text-sm">{t('notebook.generateWithAi')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Subject selector */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {t('notebook.subjectLabel')}
            </label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setSelectedMaterialIds([]);
                setError('');
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">{t('notebook.selectSubjectPlaceholder')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Material picker */}
          {subjectId && (
            <MaterialPicker
              subjectId={Number(subjectId)}
              selectedMaterialIds={selectedMaterialIds}
              onSelectionChange={setSelectedMaterialIds}
            />
          )}

          {/* Topic input */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {t('notebook.topicLabel')} <span className="text-text-muted font-normal">{t('notebook.topicOptionalHint')}</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('notebook.topicPlaceholder')}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isGenerating) handleGenerate(); }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-danger bg-danger/5 px-3 py-2 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !subjectId || selectedMaterialIds.length === 0}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              'bg-primary text-white hover:bg-primary/90 shadow-sm',
              (isGenerating || !subjectId || selectedMaterialIds.length === 0) && 'opacity-50 pointer-events-none'
            )}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                {t('notebook.aiWriting')}
              </>
            ) : (
              <>
                <Sparkles size={15} />
                {t('notebook.generateNote')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
