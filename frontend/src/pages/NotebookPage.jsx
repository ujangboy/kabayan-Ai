import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { notesAPI, subjectAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { extractTitle, nextPlaceholderTitle } from '@/components/notebook/shared';
import { NotebookSidebar } from '@/components/notebook/NotebookSidebar';
import { NoteView } from '@/components/notebook/NoteView';
import { GeneratePanel } from '@/components/notebook/GeneratePanel';
import { NotebookEmptyState } from '@/components/notebook/NotebookEmptyState';

export default function NotebookPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [showList, setShowList] = useState(true);
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

  // Buka note dari URL (klik item di ContextSidebar) — re-run saat param berubah
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nid = params.get('note_id');
    if (!nid) return;
    if (isLoading) return;
    const n = (notesData?.notes || []).find((x) => String(x.id) === nid);
    if (n) setSelectedNote(n);
    navigate('/notebook', { replace: true });
  }, [location.search, isLoading, navigate]);

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
    toast.confirm({
      title: t('notebook.confirmDeleteNote'),
      message: t('notebook.confirmDeleteNote'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  const handleClearAll = () => {
    toast.confirm({
      title: t('notebook.confirmClearAll'),
      message: t('notebook.confirmClearAll'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => clearMutation.mutate(),
    });
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ═══ Sidebar — collapsible with Toggle List ═══ */}
      <AnimatePresence initial={false}>
        {showList && (
          <motion.div
            key="note-list"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 overflow-hidden border-r border-slate-800 hidden md:flex"
          >
            <div className="w-72 h-full">
              <NotebookSidebar
                isLoading={isLoading}
                notes={notes}
                filteredNotes={filteredNotes}
                pinnedNotes={pinnedNotes}
                unpinnedNotes={unpinnedNotes}
                selectedNote={selectedNote}
                noteSearch={noteSearch}
                setNoteSearch={setNoteSearch}
                isCreating={isCreating}
                onCreateNote={handleCreateNote}
                onShowGenerate={() => setShowGeneratePanel(true)}
                onSelectNote={(n) => setSelectedNote(n)}
                onPin={(id) => pinMutation.mutate(id)}
                onDelete={handleDelete}
                onClearAll={handleClearAll}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Main content — max space when list hidden ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {/* Toggle List bar — hidden when sidebar visible on desktop, always visible on mobile */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <button
            onClick={() => setShowList(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-medium transition-colors"
            title={showList ? 'Sembunyikan daftar' : 'Tampilkan daftar'}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </span>
            {showList ? 'Sembunyikan Daftar' : 'Tampilkan Daftar'}
          </button>
          <span className="text-xs text-slate-500 hidden sm:inline">Notebook — Editor & Previewer</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {selectedNote ? (
            <motion.div
              key={selectedNote.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex-1 flex flex-col min-w-0 overflow-hidden"
            >
              <NoteView
                note={selectedNote}
                onBack={() => setSelectedNote(null)}
                onSave={handleContentSave}
                onPin={() => pinMutation.mutate(selectedNote.id)}
                onDelete={() => {
                  toast.confirm({
                    title: t('notebook.confirmDeleteNote'),
                    message: t('notebook.confirmDeleteNote'),
                    danger: true,
                    confirmLabel: t('common.delete'),
                    onConfirm: () => deleteMutation.mutate(selectedNote.id),
                  });
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="flex-1 flex flex-col min-w-0 overflow-hidden"
            >
              <NotebookEmptyState onCreate={handleCreateNote} isCreating={isCreating} />
            </motion.div>
          )}
        </AnimatePresence>
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
