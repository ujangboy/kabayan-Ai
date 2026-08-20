import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { dataAPI } from '@/services/api';
import { useTranslation } from 'react-i18next';
import { HardDrive } from '@/icons';

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
        <HardDrive size={14} className="text-primary-light" />
        <span className="text-xs font-semibold">{t('settings.data.storage')}</span>
      </div>
      <div className="h-1.5 bg-card rounded-full overflow-hidden mb-1.5">
        <motion.div
          className="h-full bg-gradient-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>{pct}%</span>
        <span>{formatBytes(used)} / {formatBytes(total)}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
