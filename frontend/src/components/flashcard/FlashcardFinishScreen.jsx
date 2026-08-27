import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';


export default function FlashcardFinishScreen({ knownCount, total, subjectName, onRestart, onClose }) {
  const { t } = useTranslation();
  const pct = Math.round((knownCount / total) * 100);
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card-base text-center max-w-sm w-full p-8"
      >
        <Icon name={ICONS.learning.trophy} size={48} className="mx-auto text-warning mb-4" />
        <h2 className="text-xl font-bold text-text mb-1">{t('flashcard.sessionComplete')}</h2>
        <p className="text-text-secondary text-sm mb-6">{subjectName}</p>
        <div className="text-5xl font-bold text-primary mb-2">{pct}%</div>
        <p className="text-sm text-text-secondary mb-6">
          {t('flashcard.sessionResult', { knownCount, total })}
        </p>
        <div className="flex gap-2">
          <Button onClick={onRestart} className="flex-1 justify-center text-sm" variant="primary">
            <Icon name={ICONS.actions.replay} size={14} /> {t('flashcard.retry')}
          </Button>
          <Button onClick={onClose} className="flex-1 justify-center text-sm border border-border" variant="ghost">
            {t('flashcard.done')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}