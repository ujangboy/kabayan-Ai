import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ICONS } from '@/lib/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { subjectAPI } from '@/services/api';
import { formatDate, formatTimeOnly } from '@/utils';
import { Tooltip, Modal, Button, Input, Textarea, Select, EmptyState, Skeleton, SubjectBadge , Icon } from '@/components/ui';
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
      <div className="w-full space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('subjects.title')}</h1>
            <p className="text-text-secondary text-base mt-1">{t('subjects.subtitle')}</p>
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
              <Icon name={ICONS.actions.addOutline} size={14} />
              {t('subjects.addNew')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card-base p-4 space-y-3">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </>
          ) : subjects.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState
                icon={ICONS.learning.bookOpen}
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
            filteredSubjects.map((s, idx) => {
              const progress = Math.min(100, s.best_score ?? 0);
              const meta = [
                { icon: ICONS.learning.trophy,     value: s.best_score ?? '—', label: t('subjects.statScore'),      color: 'text-warning' },
                { icon: ICONS.ui.help, value: s.total_quizzes ?? 0,  label: t('subjects.statQuizzes'),    color: 'text-accent-teal' },
                { icon: ICONS.nav.flashcard, value: s.total_flashcards ?? 0, label: t('subjects.statFlashcards'), color: 'text-accent-purple' },
                { icon: ICONS.files.document,   value: s.total_materials ?? 0, label: t('subjects.statMaterials'),  color: 'text-accent-blue' },
              ];
              return (
                <Link key={s.id} to={`/subjects/${s.id}`} className="group block">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-slate-900/70 border border-slate-800 hover:border-white/[0.16] rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md group h-full"
                  >
                    {/* Header — badge inisial + nama + aksi */}
                    <div className="flex items-start gap-3">
                      <SubjectBadge name={s.name} tone={idx} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text truncate">{s.name}</h3>
                        <p className="text-xs text-text-muted truncate">
                          {[s.semester && `${t('subjects.semesterLabel')} ${s.semester}`, s.lecturer].filter(Boolean).join(' • ')}
                        </p>
                      </div>
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
                          <Icon name={ICONS.actions.delete} size={14} />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Deskripsi */}
                    {s.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 italic">"{s.description}"</p>
                    )}

                    {/* Body — grid mini metrik */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {meta.map(({ icon, value, label, color }) => (
                        <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] py-2 px-1 text-center">
                          <Icon name={icon} size={12} className={`mx-auto mb-0.5 ${color}`} />
                          <p className="text-base font-bold text-text leading-tight">{value}</p>
                          <p className="text-2xs text-text-muted uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer — progress bar tipis + timestamp */}
                    <div className="space-y-2">
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-3xs text-text-muted">
                        {s.created_at ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><Icon name={ICONS.learning.calendar} size={9} />{formatDate(s.created_at)}</span>
                            <span className="flex items-center gap-1"><Icon name={ICONS.learning.clock} size={9} />{formatTimeOnly(s.created_at)}</span>
                          </div>
                        ) : <span />}
                        <span className="font-semibold">{progress}%</span>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })
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