import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { subjectAPI, examAPI, studyAPI } from '@/services/api';
import { useUiStore } from '@/store';
import { formatDate, fadeSlide } from '@/utils';
import { Tooltip, ConfirmDialog, Skeleton, Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import ProgressCard from '@/components/ProgressCard';
import BackButton from '@/components/layout/BackButton';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';

import ScoreChart from '@/components/dashboard/ScoreChart';
import EditSubjectModal from '@/components/dashboard/EditSubjectModal';
import StudyRecommendationCard from '@/components/dashboard/StudyRecommendationCard';
import MaterialsTable from '@/components/dashboard/MaterialsTable';

const ACTIVITY_META = (t) => ({
  quiz:      { icon: ICONS.ui.help, label: t('subjectDashboard.activityQuiz'),      cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  ujian:     { icon: ICONS.learning.trophy,     label: t('subjectDashboard.activityExam'),      cls: 'bg-primary/10 text-primary-light border-primary/20' },
  flashcard: { icon: ICONS.nav.flashcard, label: t('subjectDashboard.activityFlashcard'), cls: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  materi:    { icon: ICONS.files.document,   label: t('subjectDashboard.activityMaterial'),  cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
});

function QueryErrorCard({ title }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-red-500/30 bg-surface p-4">
      <p className="text-xs text-red-400">{t('subjectDashboard.queryError', { title })}</p>
    </div>
  );
}

function MetricBar({ subject, masteryPct, t }) {
  const items = [
    { icon: ICONS.files.document, label: t('subjectDashboard.statMaterials'), value: subject.total_materials, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { icon: ICONS.nav.flashcard, label: t('subjectDashboard.statFlashcards'), value: subject.total_flashcards, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
    { icon: ICONS.learning.trophy, label: t('subjectDashboard.statAvgScore'), value: subject.avg_score, suffix: subject.avg_score != null ? '/100' : '', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: ICONS.learning.progress, label: t('subjectDashboard.statMastery', 'Progress'), value: masteryPct, suffix: masteryPct != null ? '%' : '', color: 'text-primary-light', bg: 'bg-primary/10' },
  ];
  return (
    <div className="flex h-14 rounded-xl border border-border bg-surface divide-x divide-border overflow-hidden">
      {items.map((it) => (
        <div key={it.label} className="flex-1 flex items-center gap-2.5 px-3.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${it.bg} border border-border`}>
            <Icon name={it.icon} size={14} className={it.color} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none text-text truncate">
              {it.value != null ? it.value : '—'}
              {it.suffix && <span className="text-2xs font-normal text-text-secondary ml-0.5">{it.suffix}</span>}
            </p>
            <p className="text-2xs leading-none text-text-secondary truncate mt-0.5">{it.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SubjectDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const subjectId = Number(id);
  const setLastSubjectId = useUiStore((s) => s.setLastSubjectId);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    if (subjectId) setLastSubjectId(subjectId);
    return () => setLastSubjectId(null);
  }, [subjectId, setLastSubjectId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subject-dashboard', subjectId],
    queryFn: () => subjectAPI.getDashboard(subjectId).then((res) => res.data),
    enabled: !!subjectId,
  });

  const { data: learningProfile } = useQuery({
    queryKey: ['learning-profile', subjectId],
    queryFn: () => examAPI.getLearningProfile(subjectId),
    enabled: !!subjectId,
  });

  const { data: studyRoute, isError: isRouteError } = useQuery({
    queryKey: ['study-route', subjectId],
    queryFn: () => studyAPI.route(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: studyProgress, isError: isProgressError } = useQuery({
    queryKey: ['study-progress', subjectId],
    queryFn: () => studyAPI.progress(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => subjectAPI.delete(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      navigate('/subjects');
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err) || t('subjectDashboard.deleteError'));
    },
  });

  const subject = data?.subject;
  const scoreHistory = data?.score_history || [];
  const recentActivity = data?.recent_activity || [];
  const materials = subject?.materials || [];
  const masteryPct = subject?.best_score ?? learningProfile?.estimated_level ?? null;
  const hasScores = scoreHistory.filter(d => d && d.score != null).length >= 2;

  if (isLoading) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="loading" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-8 bg-base">
          <div className="w-full rounded-xl border border-border bg-surface p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-4 w-full bg-subtle" />)}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (error || !subject) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="notfound" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-8 bg-base">
          <div className="w-full rounded-xl border border-border bg-surface p-8 text-center text-text-secondary text-sm">{t('subjectDashboard.notFound')}</div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const activityMeta = ACTIVITY_META(t);

  const quickActions = [
    { icon: ICONS.learning.timer,      label: t('subjectDashboard.quickExamStart', 'Simulasi Ujian'),  to: `/exam-analyzer?subject_id=${subjectId}` },
    { icon: ICONS.ui.help, label: t('subjectDashboard.quickQuizStart', 'Mulai Quiz'),      to: `/quiz?subject_id=${subjectId}` },
    { icon: ICONS.nav.flashcard, label: t('subjectDashboard.quickFlashcardReview', 'Review Flashcard'), to: `/flashcard?subject_id=${subjectId}` },
    { icon: ICONS.actions.upload,     label: t('subjectDashboard.quickUpload', 'Upload Materi'),      to: `/materi?subject_id=${subjectId}` },
  ];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key="main" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-8 bg-base">
        <div className="w-full max-w-7xl mx-auto space-y-5">

        {/* Header compact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-border rounded-lg p-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <BackButton fallback="/subjects" label={t('back.label', { name: t('nav.subjects') })} />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Icon name={ICONS.learning.progress} size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-text truncate">{subject.name}</h1>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {subject.semester && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-subtle border border-border text-text">
                        {subject.semester}
                      </span>
                    )}
                    {subject.lecturer && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary-light">
                        {t('subjectDashboard.headerLecturer', { name: subject.lecturer })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-subtle border border-border text-text hover:bg-wash-strong transition-colors">
                <Icon name={ICONS.actions.edit} size={14} /> {t('subjectDashboard.editButton')}
              </button>
              <Tooltip label={t('common.delete')}>
                <button onClick={() => setIsDeleteOpen(true)} aria-label={t('common.delete')} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-subtle border border-border text-text-secondary hover:text-red-400 hover:border-red-500/30 transition-colors">
                  <Icon name={ICONS.actions.delete} size={14} />
                </button>
              </Tooltip>
            </div>
          </div>

          {subject.description && (
            <p className="text-sm text-text-secondary mt-3 italic">"{subject.description}"</p>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-border">
            {quickActions.map(({ icon, label, to }) => (
              <motion.button
                key={to}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(to)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-subtle border border-border text-xs font-medium text-text hover:bg-wash-strong hover:border-primary/30 transition-colors"
              >
                <Icon name={icon} size={13} /> {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Metric Bar compact h-14 */}
        <MetricBar subject={subject} masteryPct={masteryPct} t={t} />

        {/* Main grid: 8 + 4 with sticky sidebar w-80 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT — tabbed view */}
          <div className="lg:col-span-8 min-w-0">
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-2 pt-2 border-b border-border bg-surface">
                {[
                  { key: 'files', label: 'Berkas & Materi', icon: ICONS.files.document },
                  { key: 'analytics', label: 'Riwayat & Analytics', icon: ICONS.learning.barChart },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.key ? 'text-text bg-subtle' : 'text-text-secondary hover:text-text hover:bg-subtle'}`}
                  >
                    <Icon name={tab.icon} size={14} className={activeTab === tab.key ? 'text-primary-light' : 'text-text-secondary'} />
                    {tab.label}
                    {activeTab === tab.key && <motion.span layoutId="subject-tab-indicator" className="absolute inset-x-2 -bottom-px h-0.5 bg-primary rounded-full" />}
                  </button>
                ))}
              </div>

              <div className="p-4">
                <AnimatePresence mode="wait">
                  {activeTab === 'files' ? (
                    <motion.div key="files" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                      <MaterialsTable materials={materials} subjectId={subjectId} compact />
                    </motion.div>
                  ) : (
                    <motion.div key="analytics" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                      {hasScores ? (
                        <div className="rounded-xl border border-border bg-base p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Icon name={ICONS.learning.progress} size={14} className="text-primary-light" />
                            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.scoreHistoryTitle')}</h3>
                          </div>
                          <ScoreChart history={scoreHistory} />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-text-secondary">
                          {t('subjectDashboard.chartNoScores', 'Belum ada riwayat skor')}
                        </div>
                      )}
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name={ICONS.ui.bolt} size={14} className="text-text-secondary" />
                          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.recentActivityTitle')}</h3>
                        </div>
                        {recentActivity.length === 0 ? (
                          <p className="text-sm text-text-secondary text-center py-6">{t('subjectDashboard.recentActivityEmpty')}</p>
                        ) : (
                          <div className="space-y-2.5">
                            {recentActivity.slice(0, 8).map((a, i) => {
                              const meta = activityMeta[a.type] || activityMeta.materi;
                              return (
                                <div key={i} className="flex items-center gap-2.5 py-1">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.cls}`}>
                                    <Icon name={meta.icon} size={12} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <Tooltip label={a.label}>
                                      <p className="text-xs font-medium text-text truncate">{a.label}</p>
                                    </Tooltip>
                                    <p className="text-2xs text-text-secondary">{formatDate(a.date)}{a.score != null ? ` • ${a.score}` : ''}</p>
                                  </div>
                                  <span className="text-3xs px-1.5 py-0.5 rounded bg-subtle border border-border text-text-secondary shrink-0">{meta.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT — sticky sidebar w-80 / col-span-4 */}
          <div className="lg:col-span-4 min-w-0">
            <div className="lg:sticky lg:top-6 space-y-4">
              {isProgressError ? (
                <QueryErrorCard title={t('studyProgress.title')} />
              ) : (
                <ProgressCard progress={studyProgress} />
              )}
              {isRouteError ? (
                <QueryErrorCard title={t('studyRoute.title')} />
              ) : (
                <StudyRecommendationCard route={studyRoute} subjectId={subjectId} />
              )}
            </div>
          </div>
        </div>
      </div>

      <EditSubjectModal
        subject={subject}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          setIsEditOpen(false);
          queryClient.invalidateQueries(['subject-dashboard', subjectId]);
          queryClient.invalidateQueries(['subjects']);
        }}
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          setIsDeleteOpen(false);
          deleteMutation.mutate();
        }}
        title={t('subjectDashboard.deleteTitle', 'Hapus Mata Kuliah')}
        message={t('subjectDashboard.deleteConfirm', { name: subject.name })}
        loading={deleteMutation.isPending}
      />
      </motion.div>
    </AnimatePresence>
  );
}