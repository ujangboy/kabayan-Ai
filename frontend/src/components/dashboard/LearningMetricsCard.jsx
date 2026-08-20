import { motion } from 'framer-motion';

import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

export default function LearningMetricsCard({ metrics }) {
  const { t } = useTranslation();
  if (!metrics) return null;
  const fsrs = metrics.fsrs_overview || {};

  const dueCards = fsrs.due_cards ?? 0;
  const newCards = fsrs.new_cards ?? 0;
  const retention = fsrs.retention_pct ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name={ICONS.learning.barChart} size={16} className="text-accent-teal" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyMetrics.title')}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-text">{dueCards}</p>
          <p className="text-[10px] text-text-secondary mt-1">{t('studyMetrics.fsrsDue', 'Kartu Jatuh Tempo')}</p>
        </div>
        <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-text">{newCards}</p>
          <p className="text-[10px] text-text-secondary mt-1">{t('studyMetrics.fsrsNew', 'Kartu Baru')}</p>
        </div>
        <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-success">{retention}%</p>
          <p className="text-[10px] text-text-secondary mt-1">{t('studyMetrics.fsrsRetention', 'Retensi')}</p>
        </div>
      </div>
    </motion.div>
  );
}
