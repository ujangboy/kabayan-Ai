import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { studyAPI } from '@/services/api';
import { Card, Skeleton, Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';

function Tile({ icon, label, value, sub, tone }) {
  const tones = {
    blue: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    green: 'bg-success/10 text-success border-success/20',
    purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
    teal: 'bg-accent-teal/10 text-accent-teal border-accent-teal/20',
  };
  return (
    <Card className="p-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border mb-3 ${tones[tone]}`}>
        <Icon name={icon} size={16} />
      </div>
      <div className="text-xl font-bold text-text tracking-tight">{value ?? '—'}</div>
      <div className="text-xs text-text-secondary mt-0.5">
        {label}{sub ? <span className="text-text-muted"> · {sub}</span> : null}
      </div>
    </Card>
  );
}

export default function StudyInsights() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['study-insights'],
    queryFn: async () => {
      const [metrics, progress, plan, diag, graph] = await Promise.all([
        studyAPI.metrics().catch(() => ({})),
        studyAPI.progress().catch(() => ({})),
        studyAPI.dailyPlan().catch(() => ({})),
        studyAPI.diagnostic().catch(() => ({})),
        studyAPI.knowledgeGraph().catch(() => ({})),
      ]);
      return { metrics, progress, plan, diag, graph };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const fsrs = data?.metrics?.fsrs_overview || {};
  const streak = data?.progress?.streak;
  const streakDays =
    typeof streak === 'number'
      ? streak
      : (streak?.days ?? streak?.current_streak ?? streak?.current ?? null);
  const planItems = Array.isArray(data?.plan?.items) ? data.plan.items : [];
  const planMinutes = data?.plan?.total_duration_minutes ?? null;
  const bestHour = data?.plan?.best_hour ?? null;
  const readiness = data?.diag?.readiness ?? null;
  const coverage = data?.diag?.overview?.coverage_pct ?? null;
  const graphWeak = data?.graph?.meta?.weak_topics_count ?? null;
  const graphTopics = data?.graph?.meta?.topics_count ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Icon name={ICONS.learning.lightbulb} size={16} className="text-accent-purple" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {t('studyInsights.title')}
        </h2>
        <span className="text-3xs text-text-muted">{t('studyInsights.subtitle')}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          icon={ICONS.nav.flashcard}
          tone="purple"
          label={t('studyInsights.dueCards')}
          value={isLoading ? null : (fsrs.due_cards ?? 0)}
        />
        <Tile
          icon={ICONS.learning.bookmarks}
          tone="blue"
          label={t('studyInsights.newCards')}
          value={isLoading ? null : (fsrs.new_cards ?? 0)}
        />
        <Tile
          icon={ICONS.learning.progress}
          tone="green"
          label={t('studyInsights.streak')}
          value={isLoading ? null : (streakDays ?? 0)}
          sub={t('studyInsights.days')}
        />
        <Tile
          icon={ICONS.learning.trophy}
          tone="teal"
          label={t('studyInsights.retention')}
          value={isLoading ? null : (fsrs.retention_pct ?? '—')}
          sub={fsrs.retention_pct != null ? '%' : ''}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-card">
          <div className="flex items-center gap-2 mb-2">
            <Icon name={ICONS.learning.calendar} size={14} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('studyInsights.todayPlan')}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-4 w-32 rounded-lg" />
          ) : planItems.length === 0 ? (
            <p className="text-xs text-text-muted">{t('studyInsights.emptyPlan')}</p>
          ) : (
            <div className="text-sm text-text space-y-1">
              <p>
                {t('studyInsights.planItems', { count: planItems.length })} ·{' '}
                {t('studyInsights.planMinutes', { minutes: planMinutes ?? 0 })}
              </p>
              {bestHour != null && (
                <p className="text-text-secondary text-xs">
                  {t('studyInsights.bestHour', { hour: bestHour })}
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-card">
          <div className="flex items-center gap-2 mb-2">
            <Icon name={ICONS.learning.target} size={14} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('studyInsights.diagnostic')}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-4 w-32 rounded-lg" />
          ) : (
            <div className="text-sm text-text space-y-1">
              <p>
                {t('studyInsights.retention')}:{' '}
                <span className="font-semibold">
                  {readiness != null ? `${Math.round(readiness * 100)}%` : '—'}
                </span>
              </p>
              {coverage != null && (
                <p className="text-text-secondary text-xs">
                  {t('studyInsights.coverage', { pct: coverage })}
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-card">
          <div className="flex items-center gap-2 mb-2">
            <Icon name={ICONS.learning.network} size={14} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('studyInsights.knowledge')}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-4 w-32 rounded-lg" />
          ) : (
            <div className="text-sm text-text space-y-1">
              <p>{graphTopics != null ? `${graphTopics} topik` : '—'}</p>
              {graphWeak != null && graphWeak > 0 && (
                <p className="text-xs text-warning">
                  {t('studyInsights.weakTopics', { count: graphWeak })}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </motion.section>
  );
}
