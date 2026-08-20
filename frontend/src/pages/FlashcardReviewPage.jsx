import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { flashcardAPI } from '@/services/api';
import { usePageState } from '@/hooks/usePageState';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import BackButton from '@/components/layout/BackButton';
import { fadeSlide } from '@/utils';
import FlashcardReviewCard from '@/components/flashcard/FlashcardReviewCard';
import FlashcardReviewFinishScreen from '@/components/flashcard/FlashcardReviewFinishScreen';
import FlashcardReviewEmptyScreen from '@/components/flashcard/FlashcardReviewEmptyScreen';

const AUTO_ADVANCE_MS = 1200;

export default function FlashcardReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { back } = useBackNavigation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const subjectId = searchParams.get('subject_id') ? Number(searchParams.get('subject_id')) : undefined;
  const { restore: restoreSession, persist: persistSession, clear: clearSession } = usePageState('flashcard-review');

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [autoProgress, setAutoProgress] = useState(0);
  const [rerunQueue, setRerunQueue] = useState([]);
  const rerunCountRef = useRef({});
  const flipTimeRef = useRef(null);
  const autoTimerRef = useRef(null);
  const autoIntervalRef = useRef(null);

  const MAX_RERUN = 3;

  // Restore session state on mount
  useEffect(() => {
    const saved = restoreSession();
    if (saved) {
      if (saved.currentIdx) setCurrentIdx(saved.currentIdx);
      if (saved.results) setResults(saved.results);
      if (saved.isFinished) setIsFinished(saved.isFinished);
      if (saved.rerunQueue) setRerunQueue(saved.rerunQueue);
      if (saved.rerunCounts) rerunCountRef.current = saved.rerunCounts;
    }
  }, []);

  // Persist session state on changes
  useEffect(() => {
    persistSession({ currentIdx, results, isFinished, rerunQueue, rerunCounts: rerunCountRef.current });
  }, [currentIdx, results, isFinished, rerunQueue]);

  // Bersihkan timer saat unmount
  useEffect(() => {
    return () => {
      clearTimeout(autoTimerRef.current);
      clearInterval(autoIntervalRef.current);
    };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['flashcard-due', subjectId ?? 'all'],
    queryFn: () => flashcardAPI.getDue(subjectId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating, responseTimeMs }) => flashcardAPI.review(id, rating, responseTimeMs),
    onError: (err) => console.error('Failed to review flashcard:', err),
  });

  const cards = data?.flashcards || [];
  const total = cards.length + rerunQueue.length;
  const currentCard = currentIdx < cards.length ? cards[currentIdx] : rerunQueue[currentIdx - cards.length];

  const handleFlip = () => {
    if (!isFlipped) flipTimeRef.current = Date.now();
    setIsFlipped(f => !f);
  };

  const goNext = useCallback(() => {
    setFeedback(null);
    setAutoProgress(0);
    setIsFlipped(false);
    setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx < total) {
        setCurrentIdx(nextIdx);
      } else {
        setIsFinished(true);
      }
    }, 150);
  }, [currentIdx, total]);

  // Auto-advance: animasi progress bar → goNext
  const startAutoAdvance = useCallback((nextFn) => {
    setAutoProgress(0);
    const startTime = Date.now();
    clearInterval(autoIntervalRef.current);
    autoIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setAutoProgress(pct);
      if (pct >= 100) clearInterval(autoIntervalRef.current);
    }, 30);
    clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      clearInterval(autoIntervalRef.current);
      nextFn();
    }, AUTO_ADVANCE_MS);
  }, []);

  const handleRate = (rating) => {
    if (feedback) return; // debounce double-click
    const responseTimeMs = flipTimeRef.current ? Date.now() - flipTimeRef.current : null;
    const entry = { id: currentCard.id, rating, response_time_ms: responseTimeMs };
    setResults(r => [...r, entry]);
    setFeedback({ rating });
    setIsFlipped(true);
    setIsSaving(true);
    reviewMutation.mutate(entry, {
      onSettled: () => setIsSaving(false),
      onSuccess: (srsData) => {
        if (rating === 0 && srsData?.rerun) {
          const count = (rerunCountRef.current[currentCard.id] || 0) + 1;
          rerunCountRef.current[currentCard.id] = count;
          if (count <= MAX_RERUN) {
            setRerunQueue(q => [...q, { ...currentCard, _rerunCount: count }]);
          }
        }
      },
    });
    startAutoAdvance(goNext);
  };

  const handleSkipAutoAdvance = () => {
    clearTimeout(autoTimerRef.current);
    clearInterval(autoIntervalRef.current);
    goNext();
  };

  const handleRestart = () => {
    clearTimeout(autoTimerRef.current);
    clearInterval(autoIntervalRef.current);
    clearSession();
    setCurrentIdx(0);
    setIsFlipped(false);
    setResults([]);
    setIsFinished(false);
    setFeedback(null);
    setAutoProgress(0);
    setRerunQueue([]);
    rerunCountRef.current = {};
  };

  const handleDone = () => {
    clearSession();
    queryClient.invalidateQueries(['flashcards']);
    queryClient.invalidateQueries(['flashcard-due']);
    back();
  };

  // ─── Loading ───
  if (isLoading) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="loading" {...fadeSlide} className="flex-1 flex items-center justify-center">
          <Icon name={ICONS.status.loading} size={32} className="animate-spin text-primary" />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="error" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-danger mb-4">{t('flashcard.loadError', { message: error?.message || 'Unknown error' })}</p>
          <BackButton />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── Tidak ada kartu due ───
  if (total === 0 && !isFinished) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="empty" {...fadeSlide} className="flex-1 flex flex-col">
          <FlashcardReviewEmptyScreen
            onGenerate={() => navigate(subjectId ? `/flashcard?subject_id=${subjectId}` : '/flashcard')}
            onBack={handleDone}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── Selesai ───
  if (isFinished) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="finished" {...fadeSlide} className="flex-1 flex flex-col">
          <FlashcardReviewFinishScreen results={results} onRestart={handleRestart} onDone={handleDone} />
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!currentCard) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="nocards" {...fadeSlide} className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-muted">
            <p className="mb-4">{t('flashcard.noCards')}</p>
            <button onClick={handleDone} className="btn-ghost border border-border">{t('common.back')}</button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key="main" {...fadeSlide} className="flex-1 flex flex-col w-full p-6 md:p-10">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <BackButton className="text-sm text-text-muted" />
        <div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
          <Icon name={ICONS.learning.brain} size={15} className="text-accent-purple" />
          {t('flashcard.reviewDaily')}
        </div>
        <span className="px-3 py-1 bg-card rounded-full text-sm font-medium text-text-secondary border border-border">
          {currentIdx + 1} / {total}
        </span>
      </div>

      {/* Info header SRS — singkat dan jelas */}
      <div className="mb-5 px-4 py-2.5 rounded-xl bg-accent-purple/8 border border-accent-purple/20 text-xs text-text-secondary shrink-0">
        {t('flashcard.srsInfo')}
        <br />
        {t('flashcard.srsInfo2')}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-8 shrink-0">
        <motion.div
          className="h-full bg-accent-purple rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIdx + 1) / total) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>

      {/* Card */}
      <FlashcardReviewCard
        currentCard={currentCard}
        isFlipped={isFlipped}
        feedback={feedback}
        autoProgress={autoProgress}
        isSaving={isSaving}
        onFlip={handleFlip}
        onRate={handleRate}
        onSkipAutoAdvance={handleSkipAutoAdvance}
      />
      </motion.div>
    </AnimatePresence>
  );
}
