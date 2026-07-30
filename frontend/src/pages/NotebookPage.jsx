import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, Edit3, X, Book } from 'lucide-react';
import { notesAPI, subjectAPI } from '@/services/api';
import { formatDate } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import MaterialPicker from '@/components/MaterialPicker';

export default function NotebookPage() {
  const queryClient = useQueryClient();
  const [selectedNote, setSelectedNote] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesAPI.getAll().then(r => r.data)
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const notes = notesData?.notes || [];
  const subjects = subjectData?.subjects || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => notesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      if (selectedNote) setSelectedNote(null);
    }
  });

  const clearMutation = useMutation({
    mutationFn: () => notesAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notes']);
      setSelectedNote(null);
    }
  });

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('Hapus catatan ini?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA catatan?')) {
      clearMutation.mutate();
    }
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
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <p className="text-text-muted text-xs p-2">Memuat...</p>
          ) : notes.length === 0 ? (
            <p className="text-text-muted text-xs p-2 text-center">Belum ada catatan.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelectedNote(n)}
                className={`group w-full text-left p-3 rounded-xl transition-colors ${selectedNote?.id === n.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-card border border-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`text-sm font-medium line-clamp-1 ${selectedNote?.id === n.id ? 'text-primary' : 'text-text'}`}>
                    {n.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(n.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger p-1 rounded-lg transition-colors"
                    title="Hapus catatan"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mb-2">{formatDate(n.created_at)}</p>
                <div className="flex items-center gap-1">
                  <Book size={10} className="text-text-secondary" />
                  <span className="text-[10px] text-text-secondary truncate">{n.subject?.name || 'Umum'}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {notes.length > 0 && (
          <div className="p-3 border-t border-border">
            <button onClick={handleClearAll} className="w-full btn-ghost text-danger hover:bg-danger/10 text-xs justify-center">
              Hapus Semua
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto p-6 md:p-10">
        {selectedNote ? (
          <div className="max-w-3xl mx-auto w-full space-y-6">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <h1 className="text-2xl font-bold text-text mb-2">{selectedNote.title}</h1>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1"><Book size={14} /> {selectedNote.subject?.name || 'Umum'}</span>
                  <span>•</span>
                  <span>{formatDate(selectedNote.created_at)}</span>
                </div>
              </div>
              <button onClick={(e) => handleDelete(selectedNote.id, e)} className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className="prose-dark max-w-none text-sm text-text pb-20">
              <MathMarkdown>{selectedNote.content}</MathMarkdown>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
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

  // Generate catatan via AI
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
    setIsGenerating(true);
    try {
      const data = new URLSearchParams();
      data.append('subject_id', formData.subject_id);
      // Hanya kirim title jika tidak kosong — backend akan auto-generate jika tidak ada
      const titleValue = topic.slice(0, 60).trim();
      if (titleValue) data.append('title', titleValue);
      if (selectedMaterialIds.length > 0) {
        data.append('material_ids', selectedMaterialIds.join(','));
      }
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Gagal generate catatan');
      }
      const result = await res.json();
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
                        disabled={isGenerating}
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

