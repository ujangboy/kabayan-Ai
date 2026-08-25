import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { SubjectBadge, Tooltip } from '@/components/ui';
import { cn } from '@/utils';
import { springLift } from '@/lib/motion';

export function FolderCard({ active, name, count, onClick, tone, index = 0 }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25, ease: [0.32, 0.72, 0, 1], ...springLift }}
      className={cn(
        'shrink-0 w-44 text-left rounded-lg border p-4 transition-all duration-200 group flex flex-col gap-3 cursor-pointer',
        'card-base',
        'hover:border-primary/40 hover:bg-wash',
        active && 'border-primary/50 bg-popover'
      )}
    >
      <div className="flex items-center justify-between">
        <SubjectBadge name={name} tone={tone} size="sm" />
        <span className={cn(
          'text-3xs font-medium px-2 py-0.5 rounded-full border',
          active
            ? 'text-primary-light bg-primary/15 border-primary/30'
            : 'text-text-muted bg-wash border-border'
        )}>
          {count}
        </span>
      </div>
      <Tooltip label={name}>
        <p className={cn('text-base font-semibold truncate', active ? 'text-primary-light' : 'text-text')}>{name}</p>
      </Tooltip>
      <p className="text-3xs text-text-muted uppercase tracking-wide -mt-2">{t('materi.folderFiles', { count })}</p>
    </motion.button>
  );
}