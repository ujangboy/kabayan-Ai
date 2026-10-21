import { useQuery } from '@tanstack/react-query';
import { formatBytes } from '@/utils';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { dataAPI } from '@/services/api';
import { useTranslation } from 'react-i18next';


export default function StorageMeter() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['data-overview'],
    queryFn: () => dataAPI.overview().then((r) => r.data),
  });

  // `/api/data/overview` mengembalikan ukuran per folder (uploads/trash) dan
  // `total` sebagai jumlah byte yang terpakai — bukan kapasitas disk.
  const uploads = Number(data?.storage?.uploads) || 0;
  const trash = Number(data?.storage?.trash) || 0;
  const used = Number(data?.storage?.total) || uploads + trash;
  const uploadsPct = used > 0 ? (uploads / used) * 100 : 0;
  const trashPct = used > 0 ? (trash / used) * 100 : 0;

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-2 mb-2 text-text-secondary">
        <Icon name={ICONS.ui.storage} size={14} className="text-primary-light" />
        <span className="text-xs font-semibold">{t('settings.data.storage')}</span>
      </div>
      <div className="flex h-1.5 bg-card rounded-full overflow-hidden mb-1.5">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${uploadsPct}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        />
        {trash > 0 && (
          <motion.div
            className="h-full bg-danger"
            initial={{ width: 0 }}
            animate={{ width: `${trashPct}%` }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          />
        )}
      </div>
      <div className="flex justify-between text-3xs text-text-muted">
        <span>{formatBytes(used)}</span>
        <span>{t('settings.data.storageTrash')}: {formatBytes(trash)}</span>
      </div>
    </div>
  );
}
