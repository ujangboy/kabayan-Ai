import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Loader2, Trophy, RotateCcw, CheckCircle2, Brain
} from 'lucide-react';
import { flashcardAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';

const AUTO_ADVANCE_MS = 1200;

export default function FlashcardReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const subjectId = searchParams.get('subject_id') ? Number(searchParams.get('subject_id')) : undefined;

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

  const SIMPLE_RATINGS = [
    { value: 0, emoji: '😕', label: t('flashcard.ratingLupa'),  cls: 'border-danger/50 text-danger hover:bg-danger/10 active:bg-danger/20' },
    { value: 2, emoji: '🙂', label: t('flashcard.ratingIngat'), cls: 'border-accent-blue/50 text-accent-blue hover:bg-accent-blue/10 active:bg-accent-blue/20' },
    { value: 3, emoji: '🎯', label: t('flashcard.ratingHafal'), cls: 'border-success/50 text-success hover:bg-success/10 active:bg-success/20' },
  ];

  const FEEDBACK_META = {
    0: { color: 'border-danger/30 bg-danger/5',       label: t('flashcard.feedbackLupa'),  msg: t('flashcard.feedbackLupaMsg') },
    2: { color: 'border-accent-blue/30 bg-accent-blue/5', label: t('flashcard.feedbackIngat'), msg: t('flashcard.feedbackIngatMsg') },
    3: { color: 'border-success/30 bg-success/5',      label: t('flashcard.feedbackHafal'), msg: t('flashcard.feedbackHafalMsg') },
  };

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
    queryClient.invalidateQueries(['flashcards']);
    queryClient.invalidateQueries(['flashcard-due']);
    navigate('/flashcard');
  };

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-danger mb-4">{t('flashcard.loadError', { message: error?.message || 'Unknown error' })}</p>
        <button onClick={() => navigate('/flashcard')} className="btn-ghost border border-border">{t('common.back')}</button>
      </div>
    );
  }

  // ─── Tidak ada kartu due ───
  if (total === 0 && !isFinished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-base text-center max-w-sm w-full p-8">
          <CheckCircle2 size={48} className="mx-auto text-success mb-4" />
<h2 className="text-xl font-bold text-text mb-2">{t('flashcard.noCardsTitle')}</h2>
           <p className="text-sm text-text-secondary mb-6">
             {t('flashcard.noCardsMessage')}
           </p>
           <button onClick={handleDone} className="btn-primary w-full justify-center text-sm">{t('flashcard.backToFlashcard')}</button>
        </motion.div>
      </div>
    );
  }

  // ─── Selesai ───
  if (isFinished) {
    const counts = { lupa: 0, ingat: 0, hafal: 0 };
    results.forEach(r => {
      if (r.rating === 0) counts.lupa++;
      else if (r.rating === 2) counts.ingat++;
      else counts.hafal++;
    });
    const remembered = counts.ingat + counts.hafal;
    const pct = Math.round((remembered / Math.max(1, results.length)) * 100);
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-base text-center max-w-sm w-full p-8">
          <Trophy size={48} className="mx-auto text-warning mb-4" />
<h2 className="text-xl font-bold text-text mb-1">{t('flashcard.reviewComplete')}</h2>
           <p className="text-text-secondary text-sm mb-4">{t('flashcard.cardsReviewed', { count: results.length })}</p>
           <div className="text-5xl font-bold text-primary mb-2">{pct}%</div>
           <p className="text-sm text-text-secondary mb-5">
             {t('flashcard.rememberedOf', { remembered, total: results.length })}
           </p>
           <div className="flex justify-center gap-3 mb-6 text-xs">
             {counts.lupa > 0 && <span className="px-2 py-1 rounded-full bg-danger/10 text-danger border border-danger/20">{t('flashcard.lupaCount', { count: counts.lupa })}</span>}
             {counts.ingat > 0 && <span className="px-2 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20">{t('flashcard.ingatCount', { count: counts.ingat })}</span>}
             {counts.hafal > 0 && <span className="px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">{t('flashcard.hafalCount', { count: counts.hafal })}</span>}
           </div>
           <div className="flex gap-2">
             <button onClick={handleRestart} className="btn-primary flex-1 justify-center text-sm">
               <RotateCcw size={14} /> {t('flashcard.repeat')}
             </button>
             <button onClick={handleDone} className="btn-ghost flex-1 justify-center text-sm border border-border">
               {t('flashcard.done')}
             </button>
           </div>
        </motion.div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-text-muted">
<p className="mb-4">{t('flashcard.noCards')}</p>
           <button onClick={handleDone} className="btn-ghost border border-border">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  const meta = feedback ? (FEEDBACK_META[feedback.rating] ?? FEEDBACK_META[0]) : null;

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 md:p-10">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button onClick={() => navigate('/flashcard')} className="btn-ghost text-sm text-text-muted">
          <ChevronLeft size={16} /> {t('common.back')}
        </button>
<div className="flex items-center gap-2 text-sm text-text-secondary font-medium">
           <Brain size={15} className="text-accent-purple" />
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
        <div
          className="h-full bg-accent-purple rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className="perspective-1000 w-full max-w-xl cursor-pointer"
          style={{ height: '280px' }}
          onClick={!feedback ? handleFlip : undefined}
        >
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.55, type: 'spring', stiffness: 280, damping: 22 }}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-accent-purple shadow-xl">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.question')}</span>
              <MathMarkdown className="text-xl font-bold text-text leading-snug text-center">{currentCard.question}</MathMarkdown>
              <p className="absolute bottom-4 text-[11px] text-text-muted">{t('flashcard.clickToSeeAnswer')}</p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-success shadow-xl"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.answer')}</span>
              <MathMarkdown className="text-lg text-text leading-relaxed text-center">{currentCard.answer}</MathMarkdown>
            </div>
          </motion.div>
        </div>

        {/* 3 tombol rating — muncul setelah flip, sebelum pilih */}
        {!feedback && isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 w-full max-w-xl"
          >
            <p className="text-center text-xs text-text-muted mb-4">{t('flashcard.howWell')}</p>
            <div className="grid grid-cols-3 gap-3">
              {SIMPLE_RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => handleRate(r.value)}
                  disabled={isSaving}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${r.cls}`}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Feedback mini strip + auto-advance bar */}
        {feedback && meta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 w-full max-w-xl"
          >
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-3 border ${meta.color}`}>
              <span className="text-sm font-semibold text-text">{meta.label}</span>
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
                className={`h-full rounded-full ${feedback.rating === 0 ? 'bg-danger' : feedback.rating === 2 ? 'bg-accent-blue' : 'bg-success'}`}
                style={{ width: `${autoProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
