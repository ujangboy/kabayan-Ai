import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import MathMarkdown from '@/components/MathMarkdown';

export default function FlashcardReviewCard({
  currentCard, isFlipped, feedback, autoProgress, isSaving, onFlip, onRate, onSkipAutoAdvance,
}) {
  const { t } = useTranslation();
  const SIMPLE_RATINGS = [
    { value: 0, Icon: ICONS.ui.sentimentBad, label: t('flashcard.ratingLupa'),  cls: 'border-danger/50 text-danger hover:bg-danger/10 active:bg-danger/20' },
    { value: 2, Icon: ICONS.ui.sentimentGood, label: t('flashcard.ratingIngat'), cls: 'border-accent-blue/50 text-accent-blue hover:bg-accent-blue/10 active:bg-accent-blue/20' },
    { value: 3, Icon: ICONS.learning.target, label: t('flashcard.ratingHafal'), cls: 'border-success/50 text-success hover:bg-success/10 active:bg-success/20' },
  ];
  const FEEDBACK_META = {
    0: { color: 'border-danger/30 bg-danger/5',       label: t('flashcard.feedbackLupa'),  msg: t('flashcard.feedbackLupaMsg') },
    2: { color: 'border-accent-blue/30 bg-accent-blue/5', label: t('flashcard.feedbackIngat'), msg: t('flashcard.feedbackIngatMsg') },
    3: { color: 'border-success/30 bg-success/5',      label: t('flashcard.feedbackHafal'), msg: t('flashcard.feedbackHafalMsg') },
  };
  const meta = feedback ? (FEEDBACK_META[feedback.rating] ?? FEEDBACK_META[0]) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div
        className="perspective-1000 w-full max-w-xl cursor-pointer"
        style={{ height: '280px' }}
        onClick={!feedback ? onFlip : undefined}
      >
        <motion.div
          className="w-full h-full relative preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.55, type: 'spring', stiffness: 280, damping: 22 }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-2 border-t-accent-purple/70 shadow-2xl shadow-primary/20">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.question')}</span>
            <MathMarkdown className="text-xl font-bold text-text leading-snug text-center">{currentCard.question}</MathMarkdown>
            <p className="absolute bottom-4 text-[11px] text-text-muted">{t('flashcard.clickToSeeAnswer')}</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-2 border-t-success/70 shadow-2xl shadow-success/20"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.answer')}</span>
            <MathMarkdown className="text-lg text-text leading-relaxed text-center">{currentCard.answer}</MathMarkdown>
          </div>
        </motion.div>
      </div>

      {/* 3 tombol rating — muncul setelah flip, sebelum pilih */}
      <AnimatePresence mode="wait" initial={false}>
        {!feedback && isFlipped && (
          <motion.div
            key="ratings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-8 w-full max-w-xl"
          >
            <p className="text-center text-xs text-text-muted mb-4">{t('flashcard.howWell')}</p>
            <div className="grid grid-cols-3 gap-3">
              {SIMPLE_RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => onRate(r.value)}
                  disabled={isSaving}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 ${r.cls}`}
                >
                  <Icon name={r.Icon} size={26} className="mb-0.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Feedback mini strip + auto-advance bar */}
        {feedback && meta && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-6 w-full max-w-xl"
          >
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-3 border ${meta.color}`}>
              <span className="text-sm font-semibold text-text">{meta.label}</span>
              <button
                onClick={onSkipAutoAdvance}
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
      </AnimatePresence>
    </div>
  );
}
