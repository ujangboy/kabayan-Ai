import { useQuery } from '@tanstack/react-query';
import { formatBytes } from '@/utils';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { dataAPI } from '@/services/api';
import { useTranslation } from 'react-i18next';


export default function StorageMeter() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['data-overview'],
    queryFn: () => dataAPI.overview().then((r) => r.data),
  });

  const used = data?.storage?.used ?? 0;
  const total = data?.storage?.total ?? 1;
  const pct = Math.min(100, Math.round((used / total) * 100));

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-2 mb-2 text-text-secondary">
        <Icon name={ICONS.ui.storage} size={14} className="text-primary-light" />
        <span className="text-xs font-semibold">{t('settings.data.storage')}</span>
      </div>
      <div className="h-1.5 bg-card rounded-full overflow-hidden mb-1.5">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
      <div className="flex justify-between text-3xs text-text-muted">
        <span>{pct}%</span>
        <span>{formatBytes(used)} / {formatBytes(total)}</span>
      </div>
    </div>
  );
}
