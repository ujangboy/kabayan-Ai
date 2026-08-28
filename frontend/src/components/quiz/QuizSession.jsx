import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { quizAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import QuizTimer from '@/components/quiz/QuizTimer';
import QuizProgressBar from '@/components/quiz/QuizProgressBar';
import { cn, fadeSlide } from '@/utils';
import { springWave } from '@/lib/motion';
import { formatDuration } from './shared';
import { usePageState } from '@/hooks/usePageState';
import { fireConfetti } from '@/utils/confetti';

// Transisi antar-view session (loading/error/soal/review/result) — crossfade halus.
function ViewShell({ view, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={view} {...fadeSlide} className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function QuizSession({ quizId, onClose }) {
  const { t } = useTranslation();
  const { restore: restoreSession, persist: persistSession, clear: clearSession } = usePageState('quiz-session');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [score, setScore] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const startTimeRef = useRef(Date.now());
  const isFinishingRef = useRef(false);
  // Perayaan saat quiz selesai dengan nilai bagus (sekali saja per sesi).
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (isFinished && score >= 70 && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti({ count: 130, origin: { x: 0.5, y: 0.35 } });
    }
  }, [isFinished, score]);

  // Restore session state on mount
  useEffect(() => {
    const saved = restoreSession();
    if (saved && saved.quizId === quizId) {
      if (saved.currentIdx) setCurrentIdx(saved.currentIdx);
      if (saved.answers) setAnswers(saved.answers);
      if (saved.isFinished) setIsFinished(saved.isFinished);
      if (saved.showReview) setShowReview(saved.showReview);
      if (saved.score) setScore(saved.score);
      if (saved.timeTaken) setTimeTaken(saved.timeTaken);
      if (saved.startTime) startTimeRef.current = saved.startTime;
    }
  }, []);

  // Persist session state on changes
  useEffect(() => {
    persistSession({ quizId, currentIdx, answers, isFinished, showReview, score, timeTaken, startTime: startTimeRef.current });
  }, [quizId, currentIdx, answers, isFinished, showReview, score, timeTaken]);

  // Clear on unmount (close)
  useEffect(() => {
    return () => clearSession();
  }, []);

  const { data: quizData, isLoading, error } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => quizAPI.getQuestions(quizId).then(r => r.data),
    enabled: !!quizId,
  });

  if (isLoading) {
    return (
      <ViewShell view="loading">
        <div className="flex-1 flex items-center justify-center">
          <Icon name={ICONS.status.loading} size={32} className="animate-spin text-primary" />
        </div>
      </ViewShell>
    );
  }

  if (error || !quizData) {
    return (
      <ViewShell view="error">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-danger mb-4">Gagal memuat quiz: {error?.message || 'Unknown error'}</p>
          <Button onClick={onClose} className="border border-border" variant="ghost">Kembali</Button>
        </div>
      </ViewShell>
    );
  }

  const questions = [
    ...(quizData.mcq || []).map(q => ({ ...q, qtype: 'mcq' })),
    ...((quizData.essay || []).map(q => ({ ...q, qtype: 'essay' }))),
  ];
  const total = questions.length;
  const mcqTotal = questions.filter(q => q.qtype === 'mcq').length;

  if (total === 0) {
    return (
      <ViewShell view="empty">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-text-muted mb-4">Quiz kosong atau soal belum tersedia.</p>
          <Button onClick={onClose} className="border border-border" variant="ghost">Kembali</Button>
        </div>
      </ViewShell>
    );
  }

  const currentQ = questions[currentIdx];
  const timerSeconds = Math.min(45 * 60, total * 60);

  const handleSelectOption = (opt) => {
    setAnswers(p => ({ ...p, [currentIdx]: opt }));
  };

  const handleEssayChange = (text) => {
    setAnswers(p => ({ ...p, [currentIdx]: text }));
  };

  const computeScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (q.qtype === 'mcq' && answers[idx] === q.answer) correct++;
    });
    const finalScore = mcqTotal > 0 ? Math.round((correct / mcqTotal) * 100) : 0;
    return { correct, wrong: mcqTotal - correct, finalScore };
  };

  const finishQuiz = async () => {
    if (isFinished || isFinishingRef.current) return;
    isFinishingRef.current = true;
    const { correct, wrong, finalScore } = computeScore();
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    setScore(finalScore);
    setTimeTaken(elapsed);
    setIsFinished(true);

    // Simpan score + tracking ke DB
    try {
      await quizAPI.saveScoreDetailed(quizId, finalScore, { correct, wrong, timeTaken: elapsed, totalQuestions: total });
    } catch {
      // Fallback: simpan tanpa detail tracking
      try { await quizAPI.saveScore(quizId, finalScore); } catch {}
    }
  };

  const handleTimeUp = () => {
    finishQuiz();
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx(c => c + 1);
    } else {
      finishQuiz();
    }
  };

  // Review View
  if (showReview) {
    return (
      <ViewShell view="review">
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text">Review Jawaban</h2>
            <Button onClick={onClose} className="text-sm" variant="ghost">{t('common.close', 'Tutup')}</Button>
          </div>

          {questions.map((q, idx) => {
            const isEssay = q.qtype === 'essay';
            const userAnswer = answers[idx];
            const isCorrect = !isEssay && userAnswer === q.answer;
            return (
              <div key={idx} className={cn('card-base p-5 border-l-4', isEssay ? 'border-warning' : isCorrect ? 'border-success' : 'border-danger')}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center', isEssay ? 'bg-warning' : isCorrect ? 'bg-success' : 'bg-danger')}>
                    {isEssay ? <Icon name={ICONS.actions.edit} size={14} className="text-white" /> : isCorrect ? <Icon name={ICONS.status.success} size={16} className="text-white" /> : <Icon name={ICONS.status.error} size={16} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-secondary">Soal {idx + 1}</p>
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-surface border-strong text-text-secondary">
                        {isEssay ? 'Essay (tidak dinilai otomatis)' : 'Pilihan Ganda'}
                      </span>
                    </div>
                    <MathMarkdown className="text-text font-medium mb-3">{q.question}</MathMarkdown>

                    <div className="space-y-2 text-base">
                      {isEssay ? (
                        <div>
                          <span className="text-text-secondary">Jawaban Anda: </span>
                          <div className="mt-1 p-3 bg-background rounded-lg border border-border">
                            <MathMarkdown className="text-base">{userAnswer || '(Tidak dijawab)'}</MathMarkdown>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-text-secondary">Jawaban Anda: </span>
                            <span className={isCorrect ? 'text-success font-medium' : 'text-danger font-medium'}>
                              {userAnswer ? <MathMarkdown className="inline">{userAnswer}</MathMarkdown> : '(Tidak dijawab)'}
                            </span>
                          </div>
                          {!isCorrect && (
                            <div>
                              <span className="text-text-secondary">Jawaban Benar: </span>
                              <span className="text-success font-medium"><MathMarkdown className="inline">{q.answer}</MathMarkdown></span>
                            </div>
                          )}
                        </>
                      )}
                      {q.explanation && (
                        <div className="mt-2 p-3 bg-background rounded-lg border border-border">
                          <p className="text-xs font-semibold text-text-secondary mb-1">Penjelasan:</p>
                          <MathMarkdown className="text-base">{q.explanation}</MathMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </ViewShell>
    );
  }

  // Result View
  if (isFinished) {
    const { correct, wrong } = computeScore();
    const recommendation =
      score >= 70
        ? { Icon: ICONS.learning.celebration, text: 'Bagus! Penguasaan materi sudah baik. Lanjut ke topik berikutnya atau coba soal yang lebih sulit.' }
        : score >= 50
          ? { Icon: ICONS.nav.subjects, text: 'Cukup baik. Review jawaban yang salah untuk memperkuat pemahaman, lalu coba lagi.' }
          : { Icon: ICONS.learning.practice, text: 'Masih perlu banyak latihan. Pelajari kembali materi terkait, lalu ulangi quiz ini.' };
    return (
      <ViewShell view="result">
        <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-base text-center max-w-md w-full p-8">
          <Icon name={ICONS.learning.trophy} size={48} className="mx-auto text-warning mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">Quiz Selesai!</h2>
          <div className="text-6xl font-bold text-primary my-4">{score}</div>
          <p className="text-xs text-text-muted mb-4">
            {mcqTotal > 0 ? `Nilai dari ${mcqTotal} soal pilihan ganda` : 'Semua soal essay (tidak dinilai otomatis)'}
            {timeTaken > 0 && ` • waktu ${formatDuration(timeTaken, t)}`}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-success/10 rounded-xl border border-success/20">
              <div className="text-2xl font-bold text-success">{correct}</div>
              <div className="text-xs text-text-secondary">Benar</div>
            </div>
            <div className="p-3 bg-danger/10 rounded-xl border border-danger/20">
              <div className="text-2xl font-bold text-danger">{wrong}</div>
              <div className="text-xs text-text-secondary">Salah</div>
            </div>
          </div>
          <div className="p-3 bg-background rounded-xl border border-border mb-6 text-sm text-text-secondary">
            <Icon name={recommendation.Icon} size={16} className="mr-1.5 inline-block text-primary" />
            {recommendation.text}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowReview(true)} className="flex-1 justify-center text-sm" variant="primary">
              Review Jawaban
            </Button>
            <Button onClick={onClose} className="flex-1 justify-center text-sm border border-border" variant="ghost">
              Kembali
            </Button>
          </div>
        </motion.div>
        </div>
      </ViewShell>
    );
  }

  // Quiz Session View
  return (
    <ViewShell view="question">
      <div className="flex-1 flex flex-col w-full p-6 md:p-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-text truncate">{quizData.title || 'Quiz'}</h2>
          <QuizTimer totalSeconds={timerSeconds} onTimeUp={handleTimeUp} isActive={!isFinished} />
        </div>

        <QuizProgressBar current={currentIdx + 1} total={total} />

        <div className="flex-1 mt-6">
          {/* Soal berganti — crossfade per soal, bukan pop */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center gap-2 mb-2">
                {currentQ.qtype === 'essay' && (
                  <span className="inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                    <Icon name={ICONS.actions.edit} size={10} /> Essay
                  </span>
                )}
              </div>
              <h3 className="text-xl font-medium text-text mb-6 leading-relaxed">
                <MathMarkdown>{currentQ.question}</MathMarkdown>
              </h3>
              {currentQ.qtype === 'essay' ? (
                <textarea
                  value={answers[currentIdx] || ''}
                  onChange={(e) => handleEssayChange(e.target.value)}
                  rows={7}
                  placeholder="Tulis jawaban Anda di sini..."
                   className="w-full px-4 py-3 bg-surface border-strong rounded-xl text-base text-text focus:outline-none focus:border-primary transition-colors resize-y"
                />
              ) : (
                <div className="space-y-3">
                  {(currentQ.options || []).map((opt, i) => {
                    const isSelected = answers[currentIdx] === opt;
                    return (
                      <button
                        key={`${currentIdx}-${opt}`}
                        onClick={() => handleSelectOption(opt)}
                        className={`relative w-full text-left p-4 rounded-xl border overflow-hidden transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-surface border-strong text-text hover:border-primary/60'
                        }`}
                      >
                        {isSelected && (
                          <motion.span layoutId="quiz-session-opt-indicator" transition={springWave} className="absolute inset-0 bg-primary/10" />
                        )}
                        <span className="relative"><MathMarkdown>{opt}</MathMarkdown></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-between mt-10">
          <Button onClick={onClose} className="text-danger" variant="ghost">Keluar</Button>
          <Button
            onClick={handleNext}
            disabled={!answers[currentIdx] && currentQ.qtype === 'mcq'}
            className="disabled:opacity-40"
           variant="primary">
            {currentIdx === total - 1 ? 'Selesai' : 'Lanjut'}
          </Button>
        </div>
      </div>
    </ViewShell>
  );
}