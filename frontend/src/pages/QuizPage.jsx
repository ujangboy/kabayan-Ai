import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HelpCircle, Play, Zap, Trophy, Trash2, Clock, Calendar, FileText } from '@/icons';
import { quizAPI, subjectAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate, formatTimeOnly } from '@/utils';
import { Tooltip, EmptyState, Select } from '@/components/ui';
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

  // Restore active quiz + read subject_id from URL
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
  }, []);

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

  // Jika ada quiz aktif, tampilkan QuizSession
  if (activeQuizId) {
    return <QuizSession key={sessionKey} quizId={activeQuizId} onClose={closeSession} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-btn-primary shrink-0">
              <HelpCircle size={20} className="text-white" />
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
              <Zap size={14} /> {t('quiz.generateButton')}
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
            <div className="col-span-full text-center py-10 text-text-muted">{t('quiz.loading')}</div>
          ) : quizzes.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState
                icon={HelpCircle}
                title={selectedSubject ? t('quiz.emptyForSubject') : t('quiz.empty')}
                action={
                  <button onClick={() => setIsGeneratorOpen(true)} className="btn-primary text-sm">
                    <Zap size={14} /> {t('quiz.generateFirst')}
                  </button>
                }
              />
            </div>
          ) : (
            quizzes.map((quiz) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-base card-hoverable p-5 flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-primary" />
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    {/* Nama materi / mata kuliah */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-semibold text-accent-blue uppercase tracking-wider truncate">
                        {quiz.subject?.name || t('quiz.genericSubject')}
                      </span>
                      {quiz.question_type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-card border border-border text-text-secondary shrink-0">
                          {QTYPE_LABEL[quiz.question_type] ? t(QTYPE_LABEL[quiz.question_type]) : quiz.question_type}
                        </span>
                      )}
                      {quiz.difficulty && DIFFICULTY_BADGE[quiz.difficulty] && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${DIFFICULTY_BADGE[quiz.difficulty].cls}`}>
                          {t(DIFFICULTY_BADGE[quiz.difficulty].label)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-text text-sm line-clamp-2">
                      {quiz.title || `Quiz #${quiz.id}`}
                    </h3>
                  </div>
                  <Tooltip label={t('common.delete')}>
                    <button
                      onClick={() => handleDelete(quiz.id)}
                      aria-label={t('common.delete')}
                      className="p-1 text-text-muted hover:text-danger transition-colors shrink-0 ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-3 mb-2 text-xs text-text-secondary flex-wrap">
                  <span className="flex items-center gap-1">
                    <HelpCircle size={12} />
                    {t('quiz.questionCount', { count: quiz.question_count || 0 })}
                  </span>
                  {quiz.score !== null && quiz.score !== undefined && (
                    <span className="flex items-center gap-1 text-warning">
                      <Trophy size={12} />
                      {quiz.score}
                    </span>
                  )}
                  {(quiz.attempt_count || 0) > 0 && (
                    <span className="text-[10px] text-text-muted">{t('quiz.playedCount', { count: quiz.attempt_count })}</span>
                  )}
                  {quiz.time_taken != null && (
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Clock size={9} />
                      {formatDuration(quiz.time_taken, t)}
                    </span>
                  )}
                </div>

                {/* Nama materi yang digunakan */}
                {(quiz.material_names || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {(quiz.material_names || []).slice(0, 3).map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
                        <FileText size={8} className="shrink-0" />{name}
                      </span>
                    ))}
                    {(quiz.material_names || []).length > 3 && (
                      <span className="text-[10px] text-text-muted">{t('quiz.moreMaterials', { count: quiz.material_names.length - 3 })}</span>
                    )}
                  </div>
                )}

                {/* Tanggal + waktu dibuat */}
                {quiz.created_at && (
                  <div className="flex items-center gap-3 mb-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar size={9} />
                      {formatDate(quiz.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {formatTimeOnly(quiz.created_at)}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => handleStartQuiz(quiz.id)}
                  className="btn-primary w-full justify-center text-xs mt-auto"
                >
                  <Play size={12} /> {quiz.score != null ? t('quiz.playAgain') : t('quiz.start')}
                </button>
              </motion.div>
            ))
          )}
        </div>

      </div>

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
    </div>
  );
}
