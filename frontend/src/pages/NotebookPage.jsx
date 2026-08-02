import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, Edit3, X, Book, Pin, Save } from 'lucide-react';
import { notesAPI, subjectAPI } from '@/services/api';
import { formatDate } from '@/utils';
import { cn } from '@/utils';
import NoteEditor from '@/components/NoteEditor';
import MaterialPicker from '@/components/MaterialPicker';

const COLORS = [
  { border: 'border-l-primary',       dot: 'bg-primary'       },
  { border: 'border-l-accent-teal',   dot: 'bg-accent-teal'   },
  { border: 'border-l-accent-purple', dot: 'bg-accent-purple'  },
  { border: 'border-l-warning',       dot: 'bg-warning'       },
  { border: 'border-l-accent-blue',   dot: 'bg-accent-blue'   },
  { border: 'border-l-success',       dot: 'bg-success'       },
];

export default function NotebookPage() {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  // 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState('saved');

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesAPI.getAll().then(r => r.data)
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const rawNotes = notesData?.notes || [];
  const subjects = subjectData?.subjects || [];

  // Sort: pinned dulu, lalu created_at desc — persis pola sortedChats di ChatPage
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

  const renameMutation = useMutation({
    mutationFn: ({ id, title }) => notesAPI.rename(id, title),
    onSuccess: (data, { id, title }) => {
      queryClient.invalidateQueries(['notes']);
      // Update selectedNote jika sedang dibuka
      if (selectedNote?.id === id) {
        setSelectedNote(prev => ({ ...prev, title }));
      }
    },
  });

  const pinMutation = useMutation({
    mutationFn: (id) => notesAPI.togglePin(id),
    onSuccess: () => queryClient.invalidateQueries(['notes']),
  });

  const updateContentMutation = useMutation({
    mutationFn: ({ id, content }) => notesAPI.updateContent(id, content),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => setSaveStatus('saved'),
    onError: () => setSaveStatus('error'),
  });

  const handleContentSave = useCallback((html) => {
    if (!selectedNote) return;
    updateContentMutation.mutate({ id: selectedNote.id, content: html });
  }, [selectedNote]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMutation = useMutation({
    mutationFn: () => notesAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setSelectedNote(null);
    },
  });

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('Hapus catatan ini?')) deleteMutation.mutate(id);
  };

  const handleRenameSubmit = (id) => {
    const trimmed = editingTitle.trim();
    if (trimmed) renameMutation.mutate({ id, title: trimmed });
    setEditingNoteId(null);
  };

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA catatan?')) clearMutation.mutate();
  };

  const renderNoteItem = (n) => {
    const color = COLORS[(n.subject?.id || 0) % COLORS.length];
    const snippet = (n.content || '')
      .replace(/#+\s/g, '').replace(/\*+/g, '').replace(/\n/g, ' ').trim()
      .slice(0, 60);

    return (
      <div
        key={n.id}
        className={cn(
          'group relative rounded-xl transition-colors border-l-2',
          color.border,
          selectedNote?.id === n.id
            ? 'bg-primary/10 border border-primary/20 border-l-2'
            : 'hover:bg-card border border-transparent'
        )}
      >
        {/* Inline rename input */}
        {editingNoteId === n.id ? (
          <input
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => handleRenameSubmit(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit(n.id);
              if (e.key === 'Escape') setEditingNoteId(null);
            }}
            className="w-full px-3 py-2 text-xs bg-background border border-primary rounded-lg text-text outline-none"
          />
        ) : (
          <button
            onClick={() => setSelectedNote(n)}
            className="w-full text-left p-3"
          >
            {/* Baris judul + tanggal (tanggal hilang saat hover, diganti action buttons) */}
            <div className="flex items-center justify-between mb-0.5">
              <span className={cn(
                'text-sm font-medium truncate flex-1 min-w-0 flex items-center gap-1',
                selectedNote?.id === n.id ? 'text-primary' : 'text-text'
              )}>
                {n.is_pinned && <Pin size={8} className="text-primary shrink-0" />}
                <span className="truncate">{n.title}</span>
              </span>
              <span className="text-[10px] text-text-muted ml-1.5 shrink-0 group-hover:hidden whitespace-nowrap">
                {formatDate(n.created_at)}
              </span>
            </div>

            {/* Nama mata kuliah */}
            {n.subject && (
              <div className="flex items-center gap-1 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                <span className="text-[10px] text-text-secondary truncate">{n.subject.name}</span>
              </div>
            )}

            {/* Cuplikan konten */}
            {snippet && (
              <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">{snippet}…</p>
            )}
          </button>
        )}

        {/* Action buttons — muncul saat hover, persis pola Chat AI */}
        {editingNoteId !== n.id && (
          <div className="absolute right-1 top-2 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-md px-0.5 py-0.5 shadow-sm">
            <button
              onClick={(e) => { e.stopPropagation(); pinMutation.mutate(n.id); }}
              title={n.is_pinned ? 'Unpin' : 'Sematkan'}
              className={cn('p-1 rounded transition-colors', n.is_pinned ? 'text-primary' : 'text-text-muted hover:text-primary')}
            >
              <Pin size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditingNoteId(n.id); setEditingTitle(n.title || ''); }}
              title="Ganti Nama"
              className="p-1 rounded text-text-muted hover:text-text transition-colors"
            >
              <Edit3 size={11} />
            </button>
            <button
              onClick={(e) => handleDelete(n.id, e)}
              title="Hapus"
              className="p-1 rounded text-text-muted hover:text-danger transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sidebar Catatan */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text text-sm">Notebook</h2>
          <button onClick={() => setIsModalOpen(true)} className="p-1 text-primary hover:bg-primary/10 rounded">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isLoading ? (
            <p className="text-text-muted text-xs p-2">Memuat...</p>
          ) : notes.length === 0 ? (
            <p className="text-text-muted text-xs p-2 text-center">Belum ada catatan.</p>
          ) : (
            <>
              {/* Section: Disematkan */}
              {pinnedNotes.length > 0 && (
                <div>
                  <p className="px-2 pt-3 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider select-none">
                    📌 Disematkan
                  </p>
                  {pinnedNotes.map(renderNoteItem)}
                </div>
              )}

              {/* Section: Catatan */}
              {unpinnedNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <p className="px-2 pt-3 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider select-none">
                      Catatan
                    </p>
                  )}
                  {unpinnedNotes.map(renderNoteItem)}
                </div>
              )}
            </>
          )}
        </div>
        {notes.length > 0 && (
          <div className="p-3 border-t border-border">
            <button onClick={handleClearAll} className="w-full btn-ghost text-danger hover:bg-danger/10 text-xs justify-center flex items-center gap-1">
              <Trash2 size={11} /> Hapus Semua
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {selectedNote ? (
          <div className="flex flex-col h-full">
            {/* Header note */}
            <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h1 className="text-xl font-bold text-text mb-1">{selectedNote.title}</h1>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1"><Book size={12} /> {selectedNote.subject?.name || 'Umum'}</span>
                  <span>•</span>
                  <span>{formatDate(selectedNote.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Status auto-save */}
                <span className={cn(
                  'text-[11px] flex items-center gap-1 transition-colors',
                  saveStatus === 'saving' && 'text-warning',
                  saveStatus === 'saved'  && 'text-success',
                  saveStatus === 'error'  && 'text-danger',
                )}>
                  {saveStatus === 'saving' && <><span className="animate-pulse">●</span> Menyimpan...</>}
                  {saveStatus === 'saved'  && <><Save size={11} /> Tersimpan</>}
                  {saveStatus === 'error'  && <>⚠ Gagal simpan</>}
                </span>
                <button
                  onClick={(e) => handleDelete(selectedNote.id, e)}
                  className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
                  title="Hapus catatan"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Editor dengan toolbar */}
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                content={selectedNote.content}
                onSave={handleContentSave}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto px-4">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <FileText size={32} className="text-text-muted" />
            </div>
            <h2 className="text-lg font-bold text-text mb-2">Notebook Anda</h2>
            <p className="text-sm text-text-secondary mb-6">Pilih catatan dari samping, atau buat catatan baru secara manual. Anda juga dapat membuat catatan otomatis dari Chat AI.</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Buat Catatan Manual
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <CreateNoteModal
            onClose={() => setIsModalOpen(false)}
            subjects={subjects}
            onSuccess={(newNote) => {
              setIsModalOpen(false);
              queryClient.invalidateQueries(['notes']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateNoteModal({ onClose, subjects, onSuccess }) {
  const [formData, setFormData] = useState({ title: '', content: '', subject_id: '' });
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  // Ref mutex — mencegah double-submit dari double-click
  const isSubmittingRef = useRef(false);

  // Generate catatan via AI — hanya isi formData, TIDAK simpan ke DB
  const handleGenerateAI = async () => {
    const topic = aiTopic.trim() || formData.title.trim();
    if (!topic) {
      alert('Isi Judul Catatan atau kolom topik terlebih dahulu sebagai konteks untuk AI.');
      return;
    }
    if (!formData.subject_id) {
      alert('Pilih mata kuliah terlebih dahulu.');
      return;
    }
    if (selectedMaterialIds.length === 0) {
      alert('Harap pilih materi terlebih dahulu.');
      return;
    }
    setIsGenerating(true);
    try {
      const payload = {
        subject_id: Number(formData.subject_id),
      };
      const titleValue = topic.slice(0, 60).trim();
      if (titleValue) payload.title = titleValue;
      if (selectedMaterialIds.length > 0) {
        payload.material_ids = selectedMaterialIds.join(',');
      }
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Gagal generate catatan');
      }
      const result = await res.json();
      // Hanya isi form — belum disimpan ke DB
      // User masih harus klik Simpan untuk menyimpan
      setFormData(p => ({ ...p, title: result.title || topic.slice(0, 60), content: result.content }));
    } catch (err) {
      alert('Gagal generate AI: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    // Guard mutex — mencegah double-submit
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const data = new URLSearchParams();
    data.append('title', formData.title);
    data.append('content', formData.content);
    if (formData.subject_id) data.append('subject_id', formData.subject_id);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      if (!res.ok) throw new Error('Gagal menyimpan catatan');
      onSuccess();
    } catch (err) {
      alert(err.message);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl card-base shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-primary" />
            <h3 className="font-semibold text-text">Catatan Baru</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto">
          {/* Baris judul + mata kuliah */}
          <div className="flex gap-3 shrink-0">
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors font-medium"
              placeholder="Judul Catatan..."
            />
            <select
              value={formData.subject_id}
              onChange={(e) => { setFormData(p => ({ ...p, subject_id: e.target.value })); setSelectedMaterialIds([]); }}
              className="w-1/3 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">-- Mata Kuliah --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <MaterialPicker
            subjectId={formData.subject_id}
            selectedMaterialIds={selectedMaterialIds}
            onSelectionChange={setSelectedMaterialIds}
          />

          {/* Panel Generate AI */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowAiPanel(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              ✨ {showAiPanel ? 'Sembunyikan Generate AI' : 'Generate Catatan dengan AI'}
            </button>
            <AnimatePresence>
              {showAiPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                    <p className="text-xs text-text-secondary">Masukkan topik yang ingin dibuatkan catatannya oleh AI:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="Contoh: Sistem Reproduksi Manusia, Hukum Newton..."
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary transition-colors"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGenerateAI(); } }}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={isGenerating || selectedMaterialIds.length === 0}
                        className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/80 disabled:opacity-50 transition-all whitespace-nowrap"
                      >
                        {isGenerating ? '⏳ Generating...' : '✨ Generate'}
                      </button>
                    </div>
                    {isGenerating && (
                      <p className="text-[10px] text-primary animate-pulse">AI sedang menulis catatan...</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Textarea konten */}
          <div className="flex-1 flex flex-col min-h-[180px]">
            <textarea
              required
              value={formData.content}
              onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
              className="w-full flex-1 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors p-4 resize-none font-mono min-h-[180px]"
              placeholder="Ketik isi catatan di sini, atau klik ✨ Generate AI di atas untuk mengisi otomatis (Mendukung format Markdown)..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button type="button" onClick={onClose} className="btn-ghost">Batal</button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.content}
              className="btn-primary"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

