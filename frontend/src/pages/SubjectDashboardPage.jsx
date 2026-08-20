import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, CreditCard, HelpCircle, Pencil, Trash2,
  TrendingUp, Trophy, Zap,
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
import MasteryProfileCard from '@/components/dashboard/MasteryProfileCard';
import TopicProgressCard from '@/components/dashboard/TopicProgressCard';
import LearningMetricsCard from '@/components/dashboard/LearningMetricsCard';
import DailyPlanCard from '@/components/dashboard/DailyPlanCard';
import StudyRecommendationCard from '@/components/dashboard/StudyRecommendationCard';
import DiagnosticCard from '@/components/dashboard/DiagnosticCard';
import KnowledgeGraphCard from '@/components/dashboard/KnowledgeGraphCard';
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

  const { data: learningProfile, isError: isProfileError } = useQuery({
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

  const { data: studyMetrics, isError: isMetricsError } = useQuery({
    queryKey: ['study-metrics', subjectId],
    queryFn: () => studyAPI.metrics(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: knowledgeGraph, isError: isGraphError } = useQuery({
    queryKey: ['study-graph', subjectId],
    queryFn: () => studyAPI.knowledgeGraph(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: diagnostic, isError: isDiagnosticError } = useQuery({
    queryKey: ['study-diagnostic', subjectId],
    queryFn: () => studyAPI.diagnostic(subjectId),
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
  const topicProgress = data?.topic_progress || [];
  const scoreHistory = data?.score_history || [];
  const recentActivity = data?.recent_activity || [];
  const materials = subject?.materials || [];

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

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="w-full space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/subjects')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
                <TrendingUp size={17} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text">{subject.name}</h1>
                <p className="text-text-secondary text-sm mt-0.5">
                  {[subject.semester, subject.lecturer && t('subjectDashboard.headerLecturer', { name: subject.lecturer })].filter(Boolean).join(' • ') || t('subjectDashboard.headerFallback')}
                </p>
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
          <p className="text-sm text-text-secondary -mt-2 italic">"{subject.description}"</p>
        )}

        {/* Quick Actions - pass subjectId */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Zap,        label: t('subjectDashboard.quickExam'),      to: `/exam-analyzer?subject_id=${subjectId}`, color: 'bg-primary/10 text-primary' },
            { icon: HelpCircle, label: t('subjectDashboard.quickQuiz'),      to: `/quiz?subject_id=${subjectId}`,          color: 'bg-accent-teal/10 text-accent-teal' },
            { icon: CreditCard, label: t('subjectDashboard.quickFlashcard'), to: `/flashcard?subject_id=${subjectId}`,     color: 'bg-accent-purple/10 text-accent-purple' },
            { icon: FileText,   label: t('subjectDashboard.quickUpload'),    to: `/materi?subject_id=${subjectId}`,        color: 'bg-accent-blue/10 text-accent-blue' },
          ].map(({ icon: Icon, label, to, color }) => (
            <motion.button
              key={to}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(to)}
              className="card-base flex items-center gap-3 p-3 text-left hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={15} />
              </div>
              <span className="text-xs font-semibold text-text">{label}</span>
            </motion.button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText}   label={t('subjectDashboard.statMaterials')}    value={subject.total_materials}  color="text-accent-blue" />
          <StatCard icon={HelpCircle} label={t('subjectDashboard.statQuizzes')}      value={subject.total_quizzes}    color="text-accent-teal" />
          <StatCard icon={CreditCard} label={t('subjectDashboard.statFlashcards')}   value={subject.total_flashcards} color="text-accent-purple" />
          <StatCard icon={TrendingUp} label={t('subjectDashboard.statAvgScore')}     value={subject.avg_score}        color="text-success" suffix={subject.avg_score != null ? '/100' : ''} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
          {/* Left column — main workspace (70%) */}
          <div className="space-y-5 min-w-0">
            {isProfileError ? (
              <QueryErrorCard title={t('studyProfile.title', 'Profil Belajar')} />
            ) : (
              <MasteryProfileCard profile={learningProfile} subject={subject} />
            )}
            <TopicProgressCard topicProgress={topicProgress} />

            {isDiagnosticError ? (
              <QueryErrorCard title={t('studyDiagnostic.title')} />
            ) : (
              <DiagnosticCard diagnostic={diagnostic} />
            )}

            {/* Score history chart */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.scoreHistoryTitle')}</h2>
              </div>
              <ScoreChart history={scoreHistory} />
            </motion.div>

            {isGraphError ? (
              <QueryErrorCard title={t('studyGraph.title')} />
            ) : (
              <KnowledgeGraphCard graph={knowledgeGraph} />
            )}
          </div>

          {/* Right column — side metrics (30%) */}
          <div className="space-y-5 min-w-0">
            <DailyPlanCard subjectId={subjectId} />

            {isRouteError ? (
              <QueryErrorCard title={t('studyRoute.title')} />
            ) : (
              <StudyRecommendationCard route={studyRoute} subjectId={subjectId} />
            )}

            {isMetricsError ? (
              <QueryErrorCard title={t('studyMetrics.title')} />
            ) : (
              <LearningMetricsCard metrics={studyMetrics} />
            )}

            {isProgressError ? (
              <QueryErrorCard title={t('subjectDashboard.progressTitle', 'Konsistensi')} />
            ) : (
              <ProgressCard progress={studyProgress} />
            )}

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.recentActivityTitle')}</h2>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-text-muted">{t('subjectDashboard.recentActivityEmpty')}</p>
              ) : (
                <div className="space-y-2.5">
                  {recentActivity.map((a, i) => {
                    const meta = activityMeta[a.type] || activityMeta.materi;
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-text truncate" title={a.label}>{a.label}</p>
                          <p className="text-[10px] text-text-muted">
                            {meta.label} • {formatDate(a.date)}
                            {a.score != null && <span className="ml-1 font-semibold text-success">{a.score}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Materials table */}
        <MaterialsTable materials={materials} subjectId={subjectId} />
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
