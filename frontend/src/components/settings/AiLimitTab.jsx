import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { dataAPI, tutorAPI } from '@/services/api';

function formatNumber(n) {
  return (n ?? 0).toLocaleString('id-ID');
}

function useCountdown(resetsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!resetsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [resetsAt]);
  if (!resetsAt) return null;
  let secs = Math.max(0, new Date(resetsAt).getTime() - now);
  if (Number.isNaN(secs)) return null;
  const h = Math.floor(secs / 3_600_000);
  secs %= 3_600_000;
  const m = Math.floor(secs / 60_000);
  secs %= 60_000;
  const s = Math.floor(secs / 1000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${h}j ${pad(m)}m ${pad(s)}d`;
}

export default function AiLimitTab() {
  const { t } = useTranslation();

  const { data: usage, isLoading: loadingUsage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => dataAPI.usage('24h').then((r) => r.data),
    staleTime: 5_000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['tutor-stats'],
    queryFn: () => tutorAPI.stats ? tutorAPI.stats().then((r) => r.data) : Promise.resolve(null),
    staleTime: 30_000,
  });

  const resetsIn = useCountdown(usage?.resets_at);

  if (loadingUsage && loadingStats) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const u = usage || {};
  const s = stats || {};

  const limit = u.limit || 8000;
  const used = u.total_tokens || 0;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  const features = u.features || [];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Progress harian sliding 24h */}
      <div className="card-base p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t('settings.aiLimit.dailyTitle')}</span>
          <span className="font-semibold text-text">
            {formatNumber(used)} / {formatNumber(limit)} {t('settings.aiLimit.tokensUnit')}
          </span>
        </div>
        <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${pct >= 90 ? 'bg-danger' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{t('settings.aiLimit.window24h')}</span>
          {resetsIn != null && <span>{t('settings.aiLimit.resetsIn', { time: resetsIn })}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-base p-4 flex flex-col gap-1">
          <Icon name={ICONS.ui.wallet} size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(u.total_tokens)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalTokensAll')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <Icon name={ICONS.status.activity} size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(u.total_calls)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalCalls')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <Icon name={ICONS.communication.chat} size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.total_messages)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.totalMessages')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <Icon name={ICONS.ui.thumbsUp} size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.helpful_count)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.helpfulCount')}</span>
        </div>
        <div className="card-base p-4 flex flex-col gap-1">
          <Icon name={ICONS.ui.thumbsDown} size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{formatNumber(s.not_helpful_count)}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.notHelpfulCount')}</span>
        </div>
      </div>

      <div className="card-base p-4">
        <h3 className="text-base font-semibold text-text mb-3">{t('settings.aiLimit.breakdownTitle')}</h3>
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