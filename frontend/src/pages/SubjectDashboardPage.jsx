import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CreditCard, Description, FileText, HelpCircle, Pencil,
  Timer, Trash2, TrendingUp, Trophy, Upload, Zap,
} from '@/icons';
import { subjectAPI, examAPI, studyAPI } from '@/services/api';
import { useUiStore } from '@/store';
import { formatDate } from '@/utils';
import { Tooltip, ConfirmDialog, Skeleton } from '@/components/ui';
import ProgressCard from '@/components/ProgressCard';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';

import StatCard from '@/components/dashboard/StatCard';
import ScoreChart from '@/components/dashboard/ScoreChart';
import EditSubjectModal from '@/components/dashboard/EditSubjectModal';
import StudyRecommendationCard from '@/components/dashboard/StudyRecommendationCard';
import MaterialsTable from '@/components/dashboard/MaterialsTable';

const ACTIVITY_META = (t) => ({
  quiz:      { icon: HelpCircle, label: t('subjectDashboard.activityQuiz'),      cls: 'bg-accent-teal/10 text-accent-teal' },
  ujian:     { icon: Trophy,     label: t('subjectDashboard.activityExam'),      cls: 'bg-primary/10 text-primary' },
  flashcard: { icon: CreditCard, label: t('subjectDashboard.activityFlashcard'), cls: 'bg-accent-purple/10 text-accent-purple' },
  materi:    { icon: FileText,   label: t('subjectDashboard.activityMaterial'),  cls: 'bg-accent-blue/10 text-accent-blue' },
});

function QueryErrorCard({ title }) {
  const { t } = useTranslation();
  return (
    <div className="card-base p-6 border-danger/30">
      <p className="text-xs text-danger">{t('subjectDashboard.queryError', { title })}</p>
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

  // Remember last viewed subject for sidebar navigation
  useEffect(() => {
    if (subjectId) setLastSubjectId(subjectId);
    return () => setLastSubjectId(null);
  }, [subjectId]);

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
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="w-full card-base p-8 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="w-full card-base p-8 text-center text-text-muted">{t('subjectDashboard.notFound')}</div>
      </div>
    );
  }

  const activityMeta = ACTIVITY_META(t);

  const quickActions = [
    { icon: Timer,      label: t('subjectDashboard.quickExamStart', 'Simulasi Ujian'),  to: `/exam-analyzer?subject_id=${subjectId}`, cls: 'hover:border-primary/50 hover:bg-primary/10' },
    { icon: HelpCircle, label: t('subjectDashboard.quickQuizStart', 'Mulai Quiz'),      to: `/quiz?subject_id=${subjectId}`,          cls: 'hover:border-accent-teal/50 hover:bg-accent-teal/10' },
    { icon: CreditCard, label: t('subjectDashboard.quickFlashcardReview', 'Review Flashcard'), to: `/flashcard?subject_id=${subjectId}`, cls: 'hover:border-accent-purple/50 hover:bg-accent-purple/10' },
    { icon: Upload,     label: t('subjectDashboard.quickUpload', 'Upload Materi'),      to: `/materi?subject_id=${subjectId}`,         cls: 'hover:border-accent-blue/50 hover:bg-accent-blue/10' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="w-full space-y-6">

        {/* Subject header + quick action bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate('/subjects')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
              <ArrowLeft size={16} /> {t('common.back')}
            </button>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
                  <TrendingUp size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-text truncate">{subject.name}</h1>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {subject.semester && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-text-secondary">
                        {subject.semester}
                      </span>
                    )}
                    {subject.lecturer && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                        {t('subjectDashboard.headerLecturer', { name: subject.lecturer })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsEditOpen(true)} className="btn-ghost px-3 py-2 rounded-xl text-sm border border-border">
                <Pencil size={14} /> {t('subjectDashboard.editButton')}
              </button>
              <Tooltip label={t('common.delete')}>
                <button onClick={() => setIsDeleteOpen(true)} aria-label={t('common.delete')} className="btn-ghost px-3 py-2 rounded-xl text-sm text-danger border border-border">
                  <Trash2 size={14} />
                </button>
              </Tooltip>
            </div>
          </div>

          {subject.description && (
            <p className="text-sm text-text-secondary mt-3 italic">"{subject.description}"</p>
          )}

          {/* Action bar — pill buttons */}
          <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-white/[0.06]">
            {quickActions.map(({ icon: Icon, label, to, cls }) => (
              <motion.button
                key={to}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(to)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.03] border border-slate-700/80 text-xs font-semibold text-text transition-colors cursor-pointer ${cls}`}
              >
                <Icon size={13} /> {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Main grid — 70% content : 30% insight sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT — main workspace */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* Metric overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Description} label={t('subjectDashboard.statMaterials')}          value={subject.total_materials}  color="text-accent-blue" />
              <StatCard icon={CreditCard}   label={t('subjectDashboard.statFlashcards')}        value={subject.total_flashcards} color="text-accent-purple" />
              <StatCard icon={Trophy}       label={t('subjectDashboard.statAvgScore')}          value={subject.avg_score}        color="text-success" suffix={subject.avg_score != null ? '/100' : ''} />
              <StatCard icon={TrendingUp}   label={t('subjectDashboard.statMastery', 'Progress Penguasaan')} value={masteryPct} color="text-primary" suffix={masteryPct != null ? '%' : ''} />
            </div>

            {/* Materials table — now in main workspace */}
            <MaterialsTable materials={materials} subjectId={subjectId} />

            {/* Bottom row — aktivitas terbaru + riwayat skor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Recent activity */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 ${!hasScores ? 'lg:col-span-2' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-text-secondary" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.recentActivityTitle')}</h2>
                </div>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap size={26} className="mx-auto mb-2 text-text-muted opacity-40" />
                    <p className="text-xs text-text-muted">{t('subjectDashboard.recentActivityEmpty')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((a, i) => {
                      const meta = activityMeta[a.type] || activityMeta.materi;
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                            <Icon size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-text truncate" title={a.label}>{a.label}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9px] text-text-secondary">
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-text-muted">{formatDate(a.date)}</span>
                              {a.score != null && (
                                <span className="text-[10px] font-semibold text-success">{a.score}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Score history chart */}
              {hasScores && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-primary" />
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.scoreHistoryTitle')}</h2>
                  </div>
                  <ScoreChart history={scoreHistory} />
                </motion.div>
              )}
            </div>
          </div>

          {/* RIGHT — insight sidebar */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            {isProgressError ? (
              <QueryErrorCard title={t('subjectDashboard.progressTitle', 'Konsistensi')} />
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
    </div>
  );
}