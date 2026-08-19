import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Trash2, FileText, HelpCircle, CreditCard, Trophy, Calendar, Clock, BookOpen } from '@/icons';
import { subjectAPI } from '@/services/api';
import { formatDate, formatTimeOnly } from '@/utils';
import { Tooltip, Modal, Button, Input, Textarea, Select, EmptyState } from '@/components/ui';
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
            <Select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="min-w-[180px]"
            >
              <option value="">{t('subjects.allSubjects', 'Semua Mata Kuliah')}</option>
              {sortedSubjects.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </Select>
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
            <div className="col-span-full card-base">
              <EmptyState
                icon={BookOpen}
                title={t('subjects.empty')}
                action={
                  <button onClick={() => setIsModalOpen(true)} className="btn-primary text-sm">{t('subjects.createNow')}</button>
                }
              />
            </div>
          ) : shownCount === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState title={t('subjects.noMatch')} />
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

      <CreateSubjectModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          queryClient.invalidateQueries(['subjects']);
        }}
      />
    </div>
  );
}

function CreateSubjectModal({ open, onClose, onSuccess }) {
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
    <Modal
      open={open}
      onClose={onClose}
      title={t('subjects.addNew')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="create-subject-form" loading={isSubmitting} disabled={!formData.name}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="create-subject-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formNameLabel')}</label>
          <Input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            placeholder={t('subjects.formNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formSemesterLabel')}</label>
            <Input
              type="text"
              value={formData.semester}
              onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))}
              placeholder={t('subjects.formSemesterPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formLecturerLabel')}</label>
            <Input
              type="text"
              value={formData.lecturer}
              onChange={(e) => setFormData(p => ({ ...p, lecturer: e.target.value }))}
              placeholder={t('subjects.formLecturerPlaceholder')}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formNotesLabel')}</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
            rows={2}
            placeholder={t('subjects.formNotesPlaceholder')}
          />
        </div>
      </form>
    </Modal>
  );
}
