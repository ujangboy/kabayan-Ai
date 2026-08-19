import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Plus, Trash2, X, FileText, HelpCircle, CreditCard, Trophy, Calendar, Clock } from '@/icons';
import { subjectAPI } from '@/services/api';
import { formatDate, formatTimeOnly } from '@/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { useToast } from '@/components/Toast';

export default function SubjectsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');

  const { data: subjectData, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const subjects = subjectData?.subjects || [];
  const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  const filteredSubjects = subjectFilter
    ? subjects.filter(s => String(s.id) === subjectFilter)
    : subjects;
  const shownCount = filteredSubjects.length;



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
    toast.confirm({
      title: t('subjects.deleteTitle', 'Hapus Mata Kuliah'),
      message: t('subjects.deleteConfirm'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('subjects.title')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t('subjects.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            >
              <option value="">Semua Mata Kuliah</option>
              {sortedSubjects.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary text-xs"
            >
              <Plus size={14} />
              {t('subjects.addNew')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="text-text-muted text-sm">{t('common.loading')}</p>
          ) : subjects.length === 0 ? (
            <div className="col-span-full card-base text-center py-10">
              <p className="text-text-muted mb-2">{t('subjects.empty')}</p>
              <button onClick={() => setIsModalOpen(true)} className="text-primary-light hover:underline text-sm">{t('subjects.createNow')}</button>
            </div>
          ) : shownCount === 0 ? (
            <div className="col-span-full card-base text-center py-10">
              <p className="text-text-muted text-sm">Tidak ada mata kuliah yang cocok.</p>
            </div>
          ) : (
            filteredSubjects.map((s, idx) => (
              <Link key={s.id} to={`/subjects/${s.id}`} className="group block">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card-base card-hoverable group flex flex-col relative overflow-hidden hover:border-primary/40"
                >
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-primary" />
                  <div className="flex justify-between items-start mb-2 pl-2 pt-1">
                    <h3 className="font-semibold text-text text-lg">{s.name}</h3>
                    <Tooltip label={t('common.delete')}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                        aria-label={t('common.delete')}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary pl-2 mb-3 flex-1">
                    {s.semester && <p><span className="text-text-muted text-xs">{t('subjects.semesterLabel')}:</span> {s.semester}</p>}
                    {s.lecturer && <p><span className="text-text-muted text-xs">{t('subjects.lecturerLabel')}:</span> {s.lecturer}</p>}
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
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">{t('subjects.statScore')}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><HelpCircle size={11} className="text-accent-teal" />{s.total_quizzes ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">{t('subjects.statQuizzes')}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><CreditCard size={11} className="text-accent-purple" />{s.total_flashcards ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">{t('subjects.statFlashcards')}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 py-1.5 px-1">
                      <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><FileText size={11} className="text-accent-blue" />{s.total_materials ?? 0}</p>
                      <p className="text-[9px] text-text-muted uppercase tracking-wide">{t('subjects.statMaterials')}</p>
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
  const { t } = useTranslation();
  const { toast } = useToast();
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
      const res = await subjectAPI.create(formData);
      if (res.data?.detail) throw new Error(res.data.detail);
      onSuccess();
    } catch (err) {
      toast.error(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-md glass rounded-dialog shadow-modal"
      >
        <div className="flex items-center justify-between p-4 divider-gradient-b relative">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-btn-primary">
              <Book size={16} className="text-white" />
            </div>
            <h3 className="font-semibold text-text">{t('subjects.addNew')}</h3>
          </div>
          <Tooltip label={t('common.close')}>
            <button onClick={onClose} aria-label={t('common.close')} className="text-text-muted hover:text-text"><X size={18} /></button>
          </Tooltip>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjects.formNameLabel')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="input-base"
              placeholder={t('subjects.formNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjects.formSemesterLabel')}</label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))}
                className="input-base"
                placeholder={t('subjects.formSemesterPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjects.formLecturerLabel')}</label>
              <input
                type="text"
                value={formData.lecturer}
                onChange={(e) => setFormData(p => ({ ...p, lecturer: e.target.value }))}
                className="input-base"
                placeholder={t('subjects.formLecturerPlaceholder')}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjects.formNotesLabel')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="input-base resize-none"
              placeholder={t('subjects.formNotesPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
            <button type="submit" disabled={isSubmitting || !formData.name} className="btn-primary">
              {isSubmitting ? t('subjects.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
