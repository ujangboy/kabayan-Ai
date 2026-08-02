import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Plus, Trash2, X, FileText, HelpCircle, CreditCard, Trophy, Calendar, Clock } from 'lucide-react';
import { subjectAPI } from '@/services/api';
import { formatDate, formatTimeOnly } from '@/utils';

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: subjectData, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const subjects = subjectData?.subjects || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => subjectAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
    },
    onError: (err) => {
      console.error('Failed to delete subject:', err);
    },
  });

  const handleDelete = (id) => {
    if (confirm('Hapus mata kuliah ini? PERHATIAN: Ini juga akan MENGHAPUS SEMUA materi, catatan, flashcard, dan quiz yang terkait!')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Mata Kuliah</h1>
            <p className="text-text-secondary text-sm mt-1">Kelola daftar mata kuliah atau topik belajar Bapak.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-xs"
          >
            <Plus size={14} />
            Mata Kuliah Baru
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="text-text-muted text-sm">Memuat data...</p>
          ) : subjects.length === 0 ? (
            <div className="col-span-full card-base text-center py-10">
              <p className="text-text-muted mb-2">Belum ada mata kuliah.</p>
              <button onClick={() => setIsModalOpen(true)} className="text-primary hover:underline text-sm">Buat sekarang</button>
            </div>
          ) : (
            subjects.map((s, idx) => (
              <Link key={s.id} to={`/subjects/${s.id}`} className="group block">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card-base group flex flex-col relative overflow-hidden hover:border-primary/40"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <h3 className="font-semibold text-text text-lg">{s.name}</h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary pl-2 mb-3 flex-1">
                    {s.semester && <p><span className="text-text-muted text-xs">Semester:</span> {s.semester}</p>}
                    {s.lecturer && <p><span className="text-text-muted text-xs">Dosen:</span> {s.lecturer}</p>}
                    {s.description && <p className="text-xs line-clamp-2 mt-2 italic">"{s.description}"</p>}
                  </div>
                  {/* Tanggal + waktu dibuat */}
                  {s.created_at && (
                    <div className="flex items-center gap-3 pl-2 mb-3 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1"><Calendar size={9} />{formatDate(s.created_at)}</span>
                      <span className="flex items-center gap-1"><Clock size={9} />{formatTimeOnly(s.created_at)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-1 px-2 pb-3 text-center">
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><Trophy size={11} className="text-warning" />{s.best_score ?? '—'}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">Skor</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><HelpCircle size={11} className="text-accent-teal" />{s.total_quizzes ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">Quiz</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><CreditCard size={11} className="text-accent-purple" />{s.total_flashcards ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">Flashcard</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><FileText size={11} className="text-accent-blue" />{s.total_materials ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">Materi</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </div>

      </div>

      <AnimatePresence>
        {isModalOpen && (
          <CreateSubjectModal
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => {
              setIsModalOpen(false);
              queryClient.invalidateQueries(['subjects']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateSubjectModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', semester: '', lecturer: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    
    setIsSubmitting(true);
    const data = new URLSearchParams();
    data.append('name', formData.name);
    data.append('semester', formData.semester);
    data.append('lecturer', formData.lecturer);
    data.append('description', formData.description);

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      if (!res.ok) throw new Error('Gagal membuat');
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
        className="w-full max-w-md card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Book size={18} className="text-primary" />
            <h3 className="font-semibold text-text">Mata Kuliah Baru</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nama Mata Kuliah *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              placeholder="Cth: Algoritma & Struktur Data"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Semester</label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
                placeholder="Cth: Ganjil 2026"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Dosen Pengampu</label>
              <input
                type="text"
                value={formData.lecturer}
                onChange={(e) => setFormData(p => ({ ...p, lecturer: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
                placeholder="Nama Dosen"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Catatan Tambahan</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Deskripsi opsional..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Batal</button>
            <button type="submit" disabled={isSubmitting || !formData.name} className="btn-primary">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
