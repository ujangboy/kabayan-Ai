import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';


export default function FlashcardReviewFinishScreen({ results, onRestart, onDone }) {
  const { t } = useTranslation();
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
        <Icon name={ICONS.learning.trophy} size={48} className="mx-auto text-warning mb-4" />
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
          <button onClick={onRestart} className="btn-primary flex-1 justify-center text-sm">
            <Icon name={ICONS.actions.replay} size={14} /> {t('flashcard.repeat')}
          </button>
          <button onClick={onDone} className="btn-ghost flex-1 justify-center text-sm border border-border">
            {t('flashcard.done')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}