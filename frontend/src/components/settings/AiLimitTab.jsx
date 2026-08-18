import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Coins, MessageSquare, Activity, ThumbsUp, ThumbsDown } from '@/icons';
import { dataAPI, tutorAPI } from '@/services/api';

function formatNumber(n) {
  return (n ?? 0).toLocaleString('id-ID');
}

export default function AiLimitTab() {
  const { t } = useTranslation();

  const { data: usage, isLoading: loadingUsage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => dataAPI.usage().then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['tutor-stats'],
    queryFn: () => tutorAPI.stats ? tutorAPI.stats().then((r) => r.data) : Promise.resolve(null),
    staleTime: 30_000,
  });

  if (loadingUsage && loadingStats) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const u = usage || {};
  const s = stats || {};

  const features = u.features || [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-base p-4 flex flex-col gap-1">
          <Coins size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(u.total_tokens)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalTokensAll')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <Activity size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(u.total_calls)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalCalls')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <MessageSquare size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.total_messages)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalMessages')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <ThumbsUp size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.helpful_count)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.helpfulCount')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <ThumbsDown size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.not_helpful_count)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.notHelpfulCount')}</span>
        </div>
      </div>

      <div className="card-base p-4">
        <h3 className="text-sm font-semibold text-text mb-3">{t('settings.aiLimit.breakdownTitle')}</h3>
        {features.length === 0 ? (
          <p className="text-xs text-text-muted">{t('settings.aiLimit.emptyBreakdown')}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2">
            {features
              .slice()
              .sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0))
              .map((f) => (
                <div key={f.feature} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text capitalize">{f.feature}</span>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>{formatNumber(f.tokens)} {t('settings.aiLimit.tokensUnit')}</span>
                    <span className="w-16 text-right">{formatNumber(f.calls)} {t('settings.aiLimit.callsUnit')}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">{t('settings.aiLimit.note')}</p>
    </div>
  );
}