import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ICONS } from '@/lib/icons';
import { springLift } from '@/lib/motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { subjectAPI } from '@/services/api';
import { cn, formatDate, formatTimeOnly } from '@/utils';
import { Tooltip, Button, Select, EmptyState, Skeleton, SubjectBadge, getSubjectPalette, Icon } from '@/components/ui';
import { useToast } from '@/components/Toast';
import CreateSubjectModal from '@/components/subjects/CreateSubjectModal';

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
            <Button
              onClick={() => setIsModalOpen(true)}
              className=""
             variant="primary">
              {t('subjects.addNew')}
            </Button>
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
                  <Button onClick={() => setIsModalOpen(true)} className="text-sm" variant="primary">{t('subjects.createNow')}</Button>
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
              const palette = getSubjectPalette(s.id);
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
                    whileHover={{ y: -3 }}
                    transition={{ delay: idx * 0.05, ...springLift }}
                    className={cn('card-base card-hoverable relative flex flex-col justify-between gap-4 group h-full overflow-hidden', palette?.card)}
                  >
                    {palette && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', palette.bar)} />}
                    {/* Header — badge inisial + nama + aksi */}
                    <div className="flex items-start gap-3">
                      <SubjectBadge name={s.name} subjectId={s.id} />
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
                        <div key={label} className="rounded-lg bg-base border border-border py-2 px-1 text-center">
                          <Icon name={icon} size={12} className={`mx-auto mb-0.5 ${color}`} />
                          <p className="text-base font-bold text-text leading-tight">{value}</p>
                          <p className="text-2xs text-text-muted uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer — progress bar tipis + timestamp */}
                    <div className="space-y-2">
                      <div className="h-1.5 rounded-full bg-wash overflow-hidden">
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
