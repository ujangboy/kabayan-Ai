import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Coins, MessageSquare, Layers, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import { tutorAPI } from '@/services/api';

function formatNumber(n) {
  return (n ?? 0).toLocaleString('id-ID');
}

export default function AiLimitTab() {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['tutor-stats'],
    queryFn: () => tutorAPI.stats ? tutorAPI.stats().then((r) => r.data) : Promise.resolve(null),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const s = stats || {};

  const CARDS = [
    { label: t('settings.aiLimit.totalTokens'), value: formatNumber(s.total_tokens), icon: Coins },
    { label: t('settings.aiLimit.totalMessages'), value: formatNumber(s.total_messages), icon: MessageSquare },
    { label: t('settings.aiLimit.totalSessions'), value: formatNumber(s.total_sessions), icon: Layers },
    { label: t('settings.aiLimit.helpfulCount'), value: formatNumber(s.helpful_count), icon: ThumbsUp },
    { label: t('settings.aiLimit.notHelpfulCount'), value: formatNumber(s.not_helpful_count), icon: ThumbsDown },
  ];

  const rate = s.helpful_rate != null ? `${s.helpful_rate}%` : '—';

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CARDS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-base p-4 flex flex-col gap-1">
            <Icon size={16} className="text-primary" />
            <span className="text-xl font-bold text-text">{value}</span>
            <span className="text-xs text-text-secondary">{label}</span>
          </div>
        ))}
        <div className="card-base p-4 flex flex-col gap-1">
          <TrendingUp size={16} className="text-primary" />
          <span className="text-xl font-bold text-text">{rate}</span>
          <span className="text-xs text-text-secondary">{t('settings.aiLimit.helpfulRate')}</span>
        </div>
      </div>

      <p className="text-xs text-text-muted">{t('settings.aiLimit.note')}</p>
    </div>
  );
}