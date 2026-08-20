import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { infoAPI } from '@/services/api';

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
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <Icon name={ICONS.communication.bot} size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text">{info.app_name || t('settings.about.appName')}</h2>
          <span className="badge badge-primary text-[10px]">v{info.version || '—'}</span>
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