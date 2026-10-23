import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { quizAPI, subjectAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate, formatTimeOnly, fadeSlide, cn } from '@/utils';
import { Tooltip, EmptyState, Skeleton, SubjectBadge, getSubjectPalette, Icon, Button } from '@/components/ui';
import { useUiStore } from '@/store';
import { usePageState } from '@/hooks/usePageState';
import { useHighlightScroll } from '@/hooks/useHighlightScroll';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
import { useToast } from '@/components/Toast';
import { formatDuration } from '@/components/quiz/shared';
import { springWave, springLift } from '@/lib/motion';
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
  const { run: runJob } = useBackgroundJob();
  const { activeId: highlightedId, missed: quizMissed } = useHighlightScroll('highlight');
  useEffect(() => {
    if (quizMissed) toast.error(t('quiz.notFound'));
  }, [quizMissed]);
  const selectedSubject = useUiStore((s) => s.subjectFilterQuiz);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);
  const quizSearch = useUiStore((s) => s.quizSearch);
  const setQuizFilter = useUiStore((s) => s.setQuizFilter);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const search = quizSearch;
  const setSearch = (v) => setQuizFilter('quizSearch', v);
  const diffFilter = useUiStore((s) => s.quizDiff);
  const setDiffFilter = (v) => setQuizFilter('quizDiff', v);
  const typeFilter = useUiStore((s) => s.quizType);
  const setTypeFilter = (v) => setQuizFilter('quizType', v);
  const sortBy = useUiStore((s) => s.quizSort);
  const setSortBy = (v) => setQuizFilter('quizSort', v);

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
  }, [location.search]);

  // Sinkronkan filter quiz ke URL agar konteks bertahan saat pindah menu.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cur = params.get('subject_id') || '';
    if (cur === selectedSubject) return;
    if (selectedSubject) params.set('subject_id', selectedSubject);
    else params.delete('subject_id');
    navigate(`/quiz?${params.toString()}`, { replace: true });
  }, [selectedSubject]);

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

  const filtered = useMemo(() => {
    let list = [...quizzes];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(quiz =>
        (quiz.title || '').toLowerCase().includes(q) ||
        (quiz.subject?.name || '').toLowerCase().includes(q)
      );
    }
    if (diffFilter !== 'all') list = list.filter(q => q.difficulty === diffFilter);
    if (typeFilter !== 'all') list = list.filter(q => q.question_type === typeFilter);
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0);
      return 0;
    });
    return list;
  }, [quizzes, search, diffFilter, typeFilter, sortBy]);

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
            <div className="w-10 h-10 rounded-xl bg-primary-solid flex items-center justify-center shadow-card shrink-0">
              <Icon name={ICONS.ui.help} size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">{t('quiz.title')}</h1>
              <p className="text-text-secondary text-sm mt-1">{t('quiz.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsGeneratorOpen(true)} className="" variant="primary">
              {t('quiz.generateButton')}
            </Button>
            {allQuizzes.length > 0 && (
              <Button onClick={handleClearAll} className="text-danger border border-danger/20 text-xs" variant="ghost">
                {t('quiz.deleteAll')}
              </Button>
            )}
          </div>
        </div>

        {/* Filters + Search (pill chips bergelombang seperti Ujian Simulasi) */}
        <div className="card-base p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name={ICONS.actions.search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
            {search && (
              <Tooltip label={t('common.close', 'Tutup')}>
                <button onClick={() => setSearch('')} aria-label={t('common.close', 'Tutup')} className="p-2 rounded-lg border border-border bg-card text-text-muted hover:text-text">
                  <Icon name={ICONS.actions.close} size={14} />
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[{ v: '', l: t('quiz.allSubjects') }, ...subjects.map(s => ({ v: String(s.id), l: s.name }))].map(sub => (
                <button key={sub.v || 'all'} onClick={() => setSubjectFilter('quiz', sub.v)} className={cn('relative overflow-hidden px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                  selectedSubject === sub.v ? 'border-primary text-primary-light' : 'bg-card text-text border-border hover:border-primary/40')}>
                  {selectedSubject === sub.v && (
                    <motion.span layoutId="quiz-subject-indicator" transition={springWave} className="absolute inset-0 bg-primary/10 rounded-lg" />
                  )}
                  <span className="relative">{sub.l}</span>
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 bg-card border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
              <option value="newest">{t('exam.history.sortNewest')}</option>
              <option value="oldest">{t('exam.history.sortOldest')}</option>
              <option value="highest">{t('exam.history.sortHighest')}</option>
              <option value="lowest">{t('exam.history.sortLowest')}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{t('quiz.difficultyLabel', 'Kesulitan')}</span>
            {['all', 'mudah', 'sedang', 'sulit'].map(d => (
              <button key={d} onClick={() => setDiffFilter(d)} className={cn('relative overflow-hidden px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                diffFilter === d ? 'border-primary text-primary-light' : 'bg-card text-text border-border hover:border-primary/40')}>
                {diffFilter === d && (
                  <motion.span layoutId="quiz-difficulty-indicator" transition={springWave} className="absolute inset-0 bg-primary/10 rounded-lg" />
                )}
                <span className="relative">{d === 'all' ? t('common.all') : t(DIFFICULTY_BADGE[d]?.label || d)}</span>
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{t('quiz.difficultyLabel', 'Tipe')}</span>
            {[['all', t('common.all')], ['mcq', t('quiz.qtypeMcq')], ['essay', t('quiz.qtypeEssay')], ['mixed', t('quiz.qtypeMixed')]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)} className={cn('relative overflow-hidden px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                typeFilter === v ? 'border-primary text-primary-light' : 'bg-card text-text border-border hover:border-primary/40')}>
                {typeFilter === v && (
                  <motion.span layoutId="quiz-type-indicator" transition={springWave} className="absolute inset-0 bg-primary/10 rounded-lg" />
                )}
                <span className="relative">{l}</span>
              </button>
            ))}
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
                  <Button onClick={() => setIsGeneratorOpen(true)} className="text-sm" variant="primary">
                    {t('quiz.generateFirst')}
                  </Button>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState
                icon={ICONS.ui.search}
                title={t('exam.history.noHistoryFilterDesc', 'Tidak ada hasil yang cocok dengan filter.')}
              />
            </div>
          ) : (
            filtered.map((quiz, idx) => {
              const qProgress = Math.min(100, quiz.score ?? 0);
              const palette = getSubjectPalette(quiz.subject?.id);
              const isHighlighted = highlightedId === String(quiz.id);
              const stats = [
                { icon: ICONS.ui.help, value: quiz.question_count || 0, label: t('quiz.questionCount', { count: quiz.question_count || 0 }), color: 'text-accent-teal' },
                { icon: ICONS.learning.trophy, value: quiz.score ?? '—', label: t('quiz.scoreLabel', 'Skor'), color: 'text-warning' },
                { icon: ICONS.learning.brain, value: quiz.attempt_count || 0, label: t('quiz.playedLabel', 'Dimainkan'), color: 'text-accent-purple' },
                { icon: ICONS.learning.clock, value: quiz.time_taken != null ? formatDuration(quiz.time_taken, t) : '—', label: t('quiz.timeLabel', 'Waktu'), color: 'text-accent-blue' },
              ];
              return (
              <motion.div
                key={quiz.id}
                id={`highlight-${quiz.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ delay: idx * 0.05, ...springLift }}
                className={cn(
                  'card-base card-hoverable relative flex flex-col justify-between gap-3 overflow-hidden',
                  isHighlighted ? 'ring-2 ring-warning/60 bg-warning/5 animate-pulse' : palette?.card
                )}
              >
                  {palette && !isHighlighted && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', palette.bar)} />}
                  {/* Header — badge + title + badges + aksi */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <SubjectBadge name={quiz.subject?.name || quiz.title} subjectId={quiz.subject?.id} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-3xs font-semibold uppercase tracking-wider truncate', palette?.icon || 'text-accent-blue')}>
                          {quiz.subject?.name || t('quiz.genericSubject')}
                        </p>
                        <h3 className="font-semibold text-text text-15 line-clamp-2">
                          {quiz.title || `Quiz #${quiz.id}`}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {quiz.question_type && (
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-wash border border-border text-text-secondary shrink-0">
                              {QTYPE_LABEL[quiz.question_type] ? t(QTYPE_LABEL[quiz.question_type]) : quiz.question_type}
                            </span>
                          )}
                          {quiz.difficulty && DIFFICULTY_BADGE[quiz.difficulty] && (
                            <span className={`text-2xs px-1.5 py-0.5 rounded border shrink-0 font-medium ${DIFFICULTY_BADGE[quiz.difficulty].cls}`}>
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
                      <div key={label} className="rounded-lg bg-base border border-border py-2 px-1 text-center">
                        <Icon name={icon} size={12} className={`mx-auto mb-0.5 ${color}`} />
                        <p className="text-base font-bold text-text leading-tight truncate">{value}</p>
                        <p className="text-2xs text-text-muted uppercase tracking-wide truncate">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Nama materi yang digunakan */}
                  {(quiz.material_names || []).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {(quiz.material_names || []).slice(0, 3).map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5 text-3xs px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
                          <Icon name={ICONS.files.document} size={8} className="shrink-0" />{name}
                        </span>
                      ))}
                      {(quiz.material_names || []).length > 3 && (
                        <span className="text-3xs text-text-muted">{t('quiz.moreMaterials', { count: quiz.material_names.length - 3 })}</span>
                      )}
                    </div>
                  )}

                  {/* Footer — progress bar + timestamp */}
                  <div className="space-y-2">
                    <div className="h-1.5 rounded-full bg-wash overflow-hidden">
                      <motion.div
                        className="h-full w-full rounded-full bg-primary origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: qProgress / 100 }}
                        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-3xs text-text-muted">
                      {quiz.created_at ? (
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Icon name={ICONS.learning.calendar} size={9} />{formatDate(quiz.created_at)}</span>
                          <span className="flex items-center gap-1"><Icon name={ICONS.learning.clock} size={9} />{formatTimeOnly(quiz.created_at)}</span>
                        </div>
                      ) : <span />}
                      <span className="font-semibold">{qProgress}%</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleStartQuiz(quiz.id)}
                    className="w-full justify-center text-xs mt-auto"
                   variant="primary">
                    <Icon name={ICONS.media.play} size={12} /> {quiz.score != null ? t('quiz.playAgain') : t('quiz.start')}
                  </Button>
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