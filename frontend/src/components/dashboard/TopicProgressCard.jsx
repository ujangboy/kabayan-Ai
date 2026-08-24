import { useState } from 'react';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { useTranslation } from 'react-i18next';

const TOPIC_STATUS_META = (t) => ({
  dikuasai:      { label: t('subjectDashboard.topicMastered'),     cls: 'badge-success' },
  berjalan:      { label: t('subjectDashboard.topicInProgress'),   cls: 'badge-warning' },
  perlu_latihan: { label: t('subjectDashboard.topicNeedsPractice'), cls: 'badge-danger' },
});

const INITIAL_LIMIT = 5;

export default function TopicProgressCard({ topicProgress }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const topicMeta = TOPIC_STATUS_META(t);
  const hasMore = topicProgress.length > INITIAL_LIMIT;
  const visibleTopics = showAll ? topicProgress : topicProgress.slice(0, INITIAL_LIMIT);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name={ICONS.learning.bookOpen} size={16} className="text-success" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.topicProgressTitle')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-3xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              {showAll ? t('common.showLess', 'Sedikit') : t('common.showAll', 'Semua topik')}
              {showAll ? <Icon name={ICONS.ui.chevronUp} size={12} /> : <Icon name={ICONS.ui.chevronDown} size={12} />}
            </button>
          )}
        </div>
      </div>

      {topicProgress.length === 0 ? (
        <p className="text-center py-6 text-text-muted text-sm">
          {t('subjectDashboard.topicProgressEmpty')}
        </p>
      ) : (
        <div className="space-y-0 divide-y divide-border">
          {visibleTopics.map((tp) => {
            const meta = topicMeta[tp.status] || topicMeta.berjalan;
            return (
              <div key={tp.topic} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-xs font-medium text-text truncate mr-2">{tp.topic}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-3xs text-text-secondary font-mono">{tp.accuracy}%</span>
                  <span className={`badge text-2xs ${meta.cls}`}>{meta.label}</span>
                </div>
              </div>
            );
          })}
          {!showAll && hasMore && (
            <p className="text-3xs text-text-muted text-center pt-2">
              +{topicProgress.length - INITIAL_LIMIT} {t('subjectDashboard.moreTopics', 'topik lainnya')}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}