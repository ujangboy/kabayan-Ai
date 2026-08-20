import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronLeft, ChevronRight } from '@/icons';
import { flashcardAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';
import { Tooltip } from '@/components/ui';
import FlashcardCard from './FlashcardCard';
import FlashcardFinishScreen from './FlashcardFinishScreen';

export default function FlashcardSession({ cards, subjectName, onClose }) {
  const { t } = useTranslation();
  const { restore: restoreSession, persist: persistSession, clear: clearSession } = usePageState('flashcard-session');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState(0);
  const [rerunQueue, setRerunQueue] = useState([]);
  const rerunCountRef = useRef({});
  const autoAdvanceTimerRef = useRef(null);
  const autoAdvanceIntervalRef = useRef(null);
  const MAX_RERUN = 3;
  const AUTO_ADVANCE_MS = 1500;

  // Restore session state on mount
  useEffect(() => {
    const saved = restoreSession();
    if (saved) {
      if (saved.currentIndex != null && saved.currentIndex < cards.length) setCurrentIndex(saved.currentIndex);
      if (saved.known) setKnown(new Set(saved.known));
      if (saved.isFinished) setIsFinished(saved.isFinished);
      if (saved.rerunQueue) setRerunQueue(saved.rerunQueue);
      if (saved.rerunCounts) rerunCountRef.current = saved.rerunCounts;
    }
  }, []);

  // Persist session state on changes
  useEffect(() => {
    persistSession({ currentIndex, known: [...known], isFinished, rerunQueue, rerunCounts: rerunCountRef.current });
  }, [currentIndex, known, isFinished, rerunQueue]);

  // Clear on unmount
  useEffect(() => {
    return () => clearSession();
  }, []);

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => flashcardAPI.delete(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries(['flashcards']);
      const previous = queryClient.getQueryData(['flashcards']);
      if (previous) {
        queryClient.setQueryData(['flashcards'], old => {
          if (!old || !old.data) return old;
          const newGroups = old.data.map(g => ({
            ...g,
            cards: g.cards.filter(c => c.id !== deletedId)
          }));
          return { ...old, data: newGroups };
        });
      }
      return { previous };
    },
    onSuccess: () => queryClient.invalidateQueries(['flashcards']),
    onError: (err, id, context) => {
      console.error('Failed to delete flashcard:', err);
      if (context?.previous) queryClient.setQueryData(['flashcards'], context.previous);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }) => flashcardAPI.review(id, rating),
    onError: (err) => console.error('Failed to review flashcard:', err),
  });

  const total = cards.length + rerunQueue.length;
  const currentCard = currentIndex < cards.length ? cards[currentIndex] : rerunQueue[currentIndex - cards.length];

  // Bersihkan timer auto-advance saat unmount
  useEffect(() => {
    return () => {
      clearTimeout(autoAdvanceTimerRef.current);
      clearInterval(autoAdvanceIntervalRef.current);
    };
  }, []);

  const totalRef = useRef(cards.length + rerunQueue.length);
  useEffect(() => { totalRef.current = cards.length + rerunQueue.length; }, [cards.length, rerunQueue.length]);

  const goNext = useCallback(() => {
    setFeedback(null);
    setAutoAdvanceProgress(0);
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => {
        const nextIdx = prev + 1;
        if (nextIdx < totalRef.current) return nextIdx;
        setIsFinished(true);
        return prev;
      });
    }, 150);
  }, []);

  const goPrev = useCallback(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    setFeedback(null);
    setAutoAdvanceProgress(0);
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(i => i - 1), 150);
    }
  }, [currentIndex]);

  // Mulai auto-advance: animasi progress bar lalu goNext otomatis
  const startAutoAdvance = useCallback((nextFn) => {
    setAutoAdvanceProgress(0);
    const startTime = Date.now();
    clearInterval(autoAdvanceIntervalRef.current);
    autoAdvanceIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setAutoAdvanceProgress(pct);
      if (pct >= 100) clearInterval(autoAdvanceIntervalRef.current);
    }, 30);
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      clearInterval(autoAdvanceIntervalRef.current);
      nextFn();
    }, AUTO_ADVANCE_MS);
  }, []);

  const handleKnow = () => {
    setKnown(prev => new Set([...prev, currentCard.id]));
    setFeedback({ known: true });
    setIsFlipped(true);
    reviewMutation.mutate({ id: currentCard.id, rating: 3 });
    startAutoAdvance(goNext);
  };

  const handleDontKnow = () => {
    setFeedback({ known: false });
    setIsFlipped(true);
    reviewMutation.mutate({ id: currentCard.id, rating: 0 }, {
      onSuccess: (data) => {
        if (data?.rerun) {
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
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    goNext();
  };

  const handleRestart = () => {
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setIsFinished(false);
    setFeedback(null);
    setAutoAdvanceProgress(0);
    setRerunQueue([]);
    rerunCountRef.current = {};
  };

  const handleDeleteCard = () => {
    toast.confirm({
      title: t('flashcard.confirmDeleteCard'),
      message: t('flashcard.confirmDeleteCard'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => {
        deleteMutation.mutate(currentCard.id);
        setFeedback(null);
        setAutoAdvanceProgress(0);
        if (currentIndex >= total - 1) {
          if (total === 1) { onClose(); } else { setCurrentIndex(total - 2); }
        }
        setIsFlipped(false);
      },
    });
  };

  // Finished screen
  if (isFinished) {
    return (
      <FlashcardFinishScreen
        knownCount={known.size}
        total={total}
        subjectName={subjectName}
        onRestart={handleRestart}
        onClose={onClose}
      />
    );
  }

  if (!currentCard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-text-muted">
          <p className="mb-4">{t('flashcard.noCards')}</p>
          <button onClick={onClose} className="btn-ghost border border-border">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 md:p-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <button onClick={onClose} className="btn-ghost text-sm text-text-muted">
          <ChevronLeft size={16} /> {t('common.back')}
        </button>
        <div className="text-sm text-text-secondary font-medium">{subjectName}</div>
        <span className="px-3 py-1 bg-card rounded-full text-sm font-medium text-text-secondary border border-border">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-8 shrink-0">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <FlashcardCard
          currentCard={currentCard}
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(f => !f)}
        />

        {/* Action buttons / feedback — after flip */}
        <AnimatePresence>
          {feedback ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-6 w-full max-w-xl"
            >
              {/* Feedback mini strip */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-3 ${
                feedback.known
                  ? 'bg-success/10 border border-success/30'
                  : 'bg-danger/10 border border-danger/30'
              }`}>
                <span className={`text-sm font-semibold ${feedback.known ? 'text-success' : 'text-danger'}`}>
                  {feedback.known ? t('flashcard.known') : t('flashcard.unknown')}
                </span>
                <button
                  onClick={handleSkipAutoAdvance}
                  className="text-xs text-text-muted hover:text-text transition-colors ml-4 shrink-0"
                >
                  {t('flashcard.skipAdvance')}
                </button>
              </div>
              {/* Auto-advance progress bar */}
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${feedback.known ? 'bg-success' : 'bg-danger'}`}
                  style={{ width: `${autoAdvanceProgress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
            </motion.div>
          ) : isFlipped && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-3 mt-8"
            >
              <button
                onClick={handleDontKnow}
                className="px-6 py-2.5 rounded-xl border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
              >
                {t('flashcard.dontKnow')}
              </button>
              <button
                onClick={handleKnow}
                className="px-6 py-2.5 rounded-xl border border-success/40 text-success text-sm font-medium hover:bg-success/10 transition-colors"
              >
                {t('flashcard.known')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between mt-8 shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          <ChevronLeft size={16} /> {t('flashcard.prev')}
        </button>
        <Tooltip label={t('flashcard.deleteCardTitle')}>
          <button
            onClick={handleDeleteCard}
            aria-label={t('flashcard.deleteCardTitle')}
            className="p-2 text-text-muted hover:text-danger transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
        <button
          onClick={goNext}
          className="btn-ghost text-sm"
        >
          {t('flashcard.skip')} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
