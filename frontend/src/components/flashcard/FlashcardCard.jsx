import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import MathMarkdown from '@/components/MathMarkdown';

export default function FlashcardCard({ currentCard, isFlipped, onFlip }) {
  const { t } = useTranslation();
  return (
    <div
      className="perspective-1000 w-full max-w-xl cursor-pointer"
      style={{ height: '280px' }}
      onClick={onFlip}
    >
      <motion.div
        className="w-full h-full relative preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.55, type: 'spring', stiffness: 280, damping: 22 }}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-2 border-t-primary/70 shadow-xl">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.question')}</span>
          <MathMarkdown className="text-xl font-bold text-text leading-snug text-center">{currentCard.question}</MathMarkdown>
          <p className="absolute bottom-4 text-[11px] text-text-muted">{t('flashcard.clickToSeeAnswer')}</p>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-2 border-t-success/70 shadow-xl"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.answer')}</span>
          <MathMarkdown className="text-lg text-text leading-relaxed text-center">{currentCard.answer}</MathMarkdown>
        </div>
      </motion.div>
    </div>
  );
}
