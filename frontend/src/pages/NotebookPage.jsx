import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Pin, Save, ChevronLeft, MoreHorizontal } from 'lucide-react';
import { notesAPI } from '@/services/api';
import { formatDate, formatDateTime } from '@/utils';
import { cn } from '@/utils';
import NoteEditor from '@/components/NoteEditor';

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
function nextPlaceholderTitle(notes) {
  const base = 'Catatan Baru';
  const existing = new Set(notes.map(n => (n.title || '').toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let i = 2;
  while (existing.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}

export default function NotebookPage() {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const createMutexRef = useRef(false);

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesAPI.getAll().then(r => r.data),
  });

  const rawNotes = notesData?.notes || [];

  const notes = [...rawNotes].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const unpinnedNotes = notes.filter(n => !n.is_pinned);

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

  const updateContentMutation = useMutation({
    mutationFn: ({ id, content }) => notesAPI.updateContent(id, content),
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
      const title = nextPlaceholderTitle(notes);
      const res = await notesAPI.create(title, '');
      const noteId = res.data?.note_id;
      queryClient.invalidateQueries(['notes']);
      if (noteId) {
        // Refetch to get full note object, then select
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
  }, [notes, queryClient]);

  // ── Auto-title from content ────────────────────────────────────────────
  const handleAutoTitle = useCallback((noteId, content) => {
    const note = rawNotes.find(n => n.id === noteId);
    if (!note) return;

    // Only auto-update if title is a placeholder
    const placeholderPattern = /^Catatan Baru(\s\d+)?$/i;
    if (!placeholderPattern.test(note.title || '')) return;

    const newTitle = extractTitle(content);
    if (newTitle && newTitle !== note.title) {
      renameMutation.mutate({ id: noteId, title: newTitle });
    }
  }, [rawNotes, renameMutation]);

  // ── Content save (debounced) ───────────────────────────────────────────
  const handleContentSave = useCallback((html) => {
    if (!selectedNote) return;
    updateContentMutation.mutate({ id: selectedNote.id, content: html });
    handleAutoTitle(selectedNote.id, html);
  }, [selectedNote, updateContentMutation, handleAutoTitle]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('Hapus catatan ini?')) deleteMutation.mutate(id);
  };

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA catatan?')) clearMutation.mutate();
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
              {n.title || 'Tanpa Judul'}
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
          <button
            onClick={(e) => { e.stopPropagation(); pinMutation.mutate(n.id); }}
            title={n.is_pinned ? 'Unpin' : 'Sematkan'}
            className={cn(
              'p-1 rounded-md transition-colors',
              n.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
            )}
          >
            <Pin size={11} />
          </button>
          <button
            onClick={(e) => handleDelete(n.id, e)}
            title="Hapus"
            className="p-1 rounded-md text-text-muted hover:text-danger transition-colors"
          >
            <Trash2 size={11} />
          </button>
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
          <h2 className="text-sm font-semibold text-text">Catatan</h2>
          <button
            onClick={handleCreateNote}
            disabled={isCreating}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-150',
              'text-primary hover:bg-primary/10',
              isCreating && 'opacity-50 pointer-events-none'
            )}
            title="Catatan Baru"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {isLoading ? (
            <p className="text-text-muted text-xs p-3 text-center">Memuat...</p>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center mb-3">
                <FileText size={20} className="text-text-muted" />
              </div>
              <p className="text-xs text-text-muted">Belum ada catatan</p>
              <button
                onClick={handleCreateNote}
                className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                + Buat Catatan
              </button>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider select-none">
                    Disematkan
                  </p>
                  {pinnedNotes.map(renderNoteCard)}
                </div>
              )}
              {unpinnedNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <p className="px-2 pt-3 pb-1 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider select-none">
                      Catatan
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
              Hapus Semua
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
              if (confirm('Hapus catatan ini?')) deleteMutation.mutate(selectedNote.id);
            }}
          />
        ) : (
          <EmptyState onCreate={handleCreateNote} isCreating={isCreating} />
        )}
      </div>
    </div>
  );
}

// ─── Note view (editor + minimal header) ──────────────────────────────────
function NoteView({ note, onBack, onSave, onPin, onDelete }) {
  const [title, setTitle] = useState(note.title || '');
  const [showMenu, setShowMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const titleRef = useRef(null);
  const saveTimerRef = useRef(null);
  const queryClient = useQueryClient();

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
            <span>Kembali</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto-save status */}
          <span className={cn(
            'text-[10px] flex items-center gap-1 transition-colors px-2',
            saveStatus === 'saving' && 'text-warning',
            saveStatus === 'saved' && 'text-success/70',
          )}>
            {saveStatus === 'saving' && <><span className="animate-pulse">●</span> Menyimpan</>}
            {saveStatus === 'saved' && <><Save size={10} /> Tersimpan</>}
          </span>

          <button
            onClick={onPin}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              note.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary'
            )}
            title={note.is_pinned ? 'Unpin' : 'Sematkan'}
          >
            <Pin size={15} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-danger/5 transition-colors"
                  >
                    Hapus Catatan
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
          placeholder="Judul Catatan"
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
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
        <FileText size={28} className="text-text-muted/40" />
      </div>
      <h2 className="text-base font-semibold text-text mb-1">Notebook</h2>
      <p className="text-xs text-text-muted mb-5 max-w-[240px] leading-relaxed">
        Pilih catatan dari samping, atau buat catatan baru untuk mulai menulis.
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
        {isCreating ? 'Membuat...' : 'Catatan Baru'}
      </button>
    </div>
  );
}
