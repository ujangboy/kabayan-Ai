import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { infoAPI } from '@/services/api';
import { KabayanMark } from '@/components/brand/KabayanLogo';

export default function AboutTab() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['app-info'],
    queryFn: () => infoAPI.get().then((r) => r.data),
  });

  if (isLoading) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const info = data || {};

  return (
    <div className="card-base p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <KabayanMark size={44} />
        <div>
          <h2 className="font-display text-lg font-bold tracking-[-0.03em] text-text">{info.app_name || t('settings.about.appName')}</h2>
          <span className="badge badge-primary text-3xs">v{info.version || '—'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-secondary">{t('settings.about.version')}:</span>
        <span className="text-text font-semibold">{info.version || '—'}</span>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        {info.description || t('settings.about.description')}
      </p>
    </div>
  );
}