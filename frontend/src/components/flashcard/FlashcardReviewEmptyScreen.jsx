import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';


export default function FlashcardReviewEmptyScreen({ onGenerate, onBack }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-base text-center max-w-sm w-full p-8">
        <Icon name={ICONS.learning.brain} size={48} className="mx-auto text-primary mb-4" />
        <h2 className="text-xl font-bold text-text mb-2">{t('flashcard.noCardsTitle')}</h2>
        <p className="text-sm text-text-secondary mb-6">
          {t('flashcard.noCardsMessage')}
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onGenerate} className="btn-primary w-full justify-center text-sm">
            {t('flashcard.generateNow')}
          </button>
          <button onClick={onBack} className="btn-ghost w-full justify-center text-sm border border-border">
            {t('common.back')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
