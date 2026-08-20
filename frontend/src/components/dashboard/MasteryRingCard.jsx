import { motion } from 'framer-motion';

import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { formatDate, cn } from '@/utils';

export default function MasteryRingCard({ subject }) {
  const { t } = useTranslation();
  const bestScore = subject?.best_score;
  const masteryPct = bestScore != null ? Math.min(100, Math.round(bestScore)) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon name={ICONS.learning.target} size={16} className="text-warning" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.masteryTitle')}</h2>
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" className="stroke-border" strokeWidth="10" />
            <motion.circle
              cx="60" cy="60" r="52" fill="none"
              className={cn(masteryPct >= 70 ? 'stroke-success' : masteryPct >= 40 ? 'stroke-warning' : 'stroke-danger')}
              strokeWidth="10" strokeLinecap="round"
              initial={{ strokeDasharray: '0 326.7', opacity: 0 }}
              animate={{ strokeDasharray: `${(masteryPct / 100) * 326.7} 326.7`, opacity: 1 }}
              transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-text">{bestScore != null ? bestScore : '—'}</span>
            <span className="text-[10px] text-text-muted">{t('subjectDashboard.bestTargetLabel')}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-text-secondary">
            {bestScore == null
              ? t('subjectDashboard.masteryNoScore')
              : masteryPct >= 70
                ? t('subjectDashboard.masteryGood')
                : masteryPct >= 40
                  ? t('subjectDashboard.masteryOnTrack')
                  : t('subjectDashboard.masteryFar')}
          </p>
          <div className="flex items-center gap-2">
            <Icon name={ICONS.learning.calendarCheck} size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">
              {subject?.last_activity_at
                ? t('subjectDashboard.lastActivity', { date: formatDate(subject.last_activity_at) })
                : t('subjectDashboard.noActivity')}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
