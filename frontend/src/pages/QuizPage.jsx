import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { quizAPI, subjectAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate, formatTimeOnly, fadeSlide } from '@/utils';
import { Tooltip, EmptyState, Select, Skeleton, SubjectBadge , Icon } from '@/components/ui';
import { useUiStore } from '@/store';
import { usePageState } from '@/hooks/usePageState';
import { useToast } from '@/components/Toast';
import { formatDuration } from '@/components/quiz/shared';
import { GenerateQuizModal } from '@/components/quiz/GenerateQuizModal';
import { QuizSession } from '@/components/quiz/QuizSession';

const QTYPE_LABEL = { mcq: 'quiz.qtypeMcq', essay: 'quiz.qtypeEssay', mixed: 'quiz.qtypeMixed' };
const DIFFICULTY_BADGE = {
  mudah:  { label: 'quiz.difficultyEasy',   cls: 'bg-success/15 text-success border-success/30' },
  sedang: { label: 'quiz.difficultyMedium', cls: 'bg-warning/15 text-warning border-warning/30' },
  sulit:  { label: 'quiz.difficultyHard',   cls: 'bg-danger/15 text-danger border-danger/30' },
};

const PAGE_KEY = 'quiz';

export default function QuizPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { restore, persist, clear } = usePageState(PAGE_KEY);
  const selectedSubject = useUiStore((s) => s.subjectFilterQuiz);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);

  // Restore active quiz + read subject_id from URL (re-run saat pindah param via sidebar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sid = params.get('subject_id');
    if (sid) setSubjectFilter('quiz', sid);
    const saved = restore();
    if (saved?.activeQuizId) {
      setActiveQuizId(saved.activeQuizId);
      if (saved.sessionKey) setSessionKey(saved.sessionKey);
    }
    if (location.search) navigate('/quiz', { replace: true });
  }, [location.search]);

  const { data: quizData, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizAPI.getAll().then(r => r.data)
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const allQuizzes = quizData?.quizzes || [];
  const subjects = subjectData?.subjects || [];

  const quizzes = selectedSubject
    ? allQuizzes.filter(q => q.subject?.id === Number(selectedSubject))
    : allQuizzes;

  const deleteMutation = useMutation({
    mutationFn: (id) => quizAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
    },
    onError: (err) => {
      console.error('Failed to delete quiz:', err);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => quizAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
    },
    onError: (err) => {
      console.error('Failed to clear quizzes:', err);
    },
  });

  // Persist active quiz id
  useEffect(() => {
    if (activeQuizId) persist({ activeQuizId, sessionKey });
  }, [activeQuizId, sessionKey]);

  const handleDelete = (id) => {
    toast.confirm({
      title: t('quiz.confirmDeleteSingle'),
      message: t('quiz.confirmDeleteSingle'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  const handleClearAll = () => {
    toast.confirm({
      title: t('quiz.confirmDeleteAll'),
      message: t('quiz.confirmDeleteAll'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => clearMutation.mutate(),
    });
  };

  const handleStartQuiz = (quizId) => {
    setActiveQuizId(quizId);
    setSessionKey(k => k + 1);
  };

  const closeSession = useCallback(() => {
    setActiveQuizId(null);
    clear();
    queryClient.invalidateQueries(['quizzes']);
  }, [queryClient]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {activeQuizId ? (
          <motion.div key="session" {...fadeSlide} className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <QuizSession key={sessionKey} quizId={activeQuizId} onClose={closeSession} />
          </motion.div>
        ) : (
          <motion.div key="list" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-btn-primary shrink-0">
              <Icon name={ICONS.ui.help} size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">{t('quiz.title')}</h1>
              <p className="text-text-secondary text-sm mt-1">{t('quiz.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedSubject}
              onChange={(e) => setSubjectFilter('quiz', e.target.value)}
            >
              <option value="">{t('quiz.allSubjects')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <button onClick={() => setIsGeneratorOpen(true)} className="btn-primary text-xs">
              <Icon name={ICONS.ui.bolt} size={14} /> {t('quiz.generateButton')}
            </button>
            {allQuizzes.length > 0 && (
              <button onClick={handleClearAll} className="btn-ghost text-danger border border-danger/20 text-xs">
                {t('quiz.deleteAll')}
              </button>
            )}
          </div>
        </div>

        {/* Quiz List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card-base p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </>
          ) : quizzes.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState
                icon={ICONS.ui.help}
                title={selectedSubject ? t('quiz.emptyForSubject') : t('quiz.empty')}
                action={
                  <button onClick={() => setIsGeneratorOpen(true)} className="btn-primary text-sm">
                    <Icon name={ICONS.ui.bolt} size={14} /> {t('quiz.generateFirst')}
                  </button>
                }
              />
            </div>
          ) : (
            quizzes.map((quiz, idx) => {
              const qProgress = Math.min(100, quiz.score ?? 0);
              const stats = [
                { icon: ICONS.ui.help, value: quiz.question_count || 0, label: t('quiz.questionCount', { count: 1 }), color: 'text-accent-teal' },
                { icon: ICONS.learning.trophy, value: quiz.score ?? '—', label: t('quiz.scoreLabel', 'Skor'), color: 'text-warning' },
                { icon: ICONS.learning.brain, value: quiz.attempt_count || 0, label: t('quiz.playedLabel', 'Dimainkan'), color: 'text-accent-purple' },
                { icon: ICONS.learning.clock, value: quiz.time_taken != null ? formatDuration(quiz.time_taken, t) : '—', label: t('quiz.timeLabel', 'Waktu'), color: 'text-accent-blue' },
              ];
              return (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-900/70 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between gap-3 transition-all shadow-md"
                >
                  {/* Header — badge + title + badges + aksi */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <SubjectBadge name={quiz.subject?.name || quiz.title} tone={idx} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-accent-blue uppercase tracking-wider truncate">
                          {quiz.subject?.name || t('quiz.genericSubject')}
                        </p>
                        <h3 className="font-semibold text-text text-sm line-clamp-2">
                          {quiz.title || `Quiz #${quiz.id}`}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {quiz.question_type && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-text-secondary shrink-0">
                              {QTYPE_LABEL[quiz.question_type] ? t(QTYPE_LABEL[quiz.question_type]) : quiz.question_type}
                            </span>
                          )}
                          {quiz.difficulty && DIFFICULTY_BADGE[quiz.difficulty] && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${DIFFICULTY_BADGE[quiz.difficulty].cls}`}>
                              {t(DIFFICULTY_BADGE[quiz.difficulty].label)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Tooltip label={t('common.delete')}>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        aria-label={t('common.delete')}
                        className="p-1 text-text-muted hover:text-danger transition-colors shrink-0"
                      >
                        <Icon name={ICONS.actions.delete} size={14} />
                      </button>
                    </Tooltip>
                  </div>

                  {/* Body — grid mini metrik */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {stats.map(({ icon, value, label, color }) => (
                      <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] py-2 px-1 text-center">
                        <Icon name={icon} size={12} className={`mx-auto mb-0.5 ${color}`} />
                        <p className="text-sm font-bold text-text leading-tight truncate">{value}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-wide truncate">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Nama materi yang digunakan */}
                  {(quiz.material_names || []).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {(quiz.material_names || []).slice(0, 3).map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
                          <Icon name={ICONS.files.document} size={8} className="shrink-0" />{name}
                        </span>
                      ))}
                      {(quiz.material_names || []).length > 3 && (
                        <span className="text-[10px] text-text-muted">{t('quiz.moreMaterials', { count: quiz.material_names.length - 3 })}</span>
                      )}
                    </div>
                  )}

                  {/* Footer — progress bar + timestamp */}
                  <div className="space-y-2">
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${qProgress}%` }}
                        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      {quiz.created_at ? (
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Icon name={ICONS.learning.calendar} size={9} />{formatDate(quiz.created_at)}</span>
                          <span className="flex items-center gap-1"><Icon name={ICONS.learning.clock} size={9} />{formatTimeOnly(quiz.created_at)}</span>
                        </div>
                      ) : <span />}
                      <span className="font-semibold">{qProgress}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartQuiz(quiz.id)}
                    className="btn-primary w-full justify-center text-xs mt-auto"
                  >
                    <Icon name={ICONS.media.play} size={12} /> {quiz.score != null ? t('quiz.playAgain') : t('quiz.start')}
                  </button>
                </motion.div>
              );
            })
          )}
        </div>

        </div>

          </motion.div>
        )}
      </AnimatePresence>

      <GenerateQuizModal
        open={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        subjects={subjects}
        onSuccess={(quizId) => {
          setIsGeneratorOpen(false);
          queryClient.invalidateQueries(['quizzes']);
          // Langsung mulai quiz yang baru dibuat
          setActiveQuizId(quizId);
          setSessionKey(k => k + 1);
        }}
      />
    </>
  );
}
