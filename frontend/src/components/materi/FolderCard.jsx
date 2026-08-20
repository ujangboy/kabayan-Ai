import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Folder } from '@/icons';
import { SubjectBadge } from '@/components/ui';
import { cn } from '@/utils';

export function FolderCard({ active, icon: Icon, name, count, onClick, tone, index = 0 }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'shrink-0 w-44 text-left rounded-2xl border p-4 transition-all duration-200 group flex flex-col gap-3',
        'bg-slate-900/70 border-slate-800 hover:border-purple-500/50 hover:shadow-md',
        active && 'border-primary/40 shadow-glow-sm bg-slate-900/90'
      )}
    >
      <div className="flex items-center justify-between">
        <SubjectBadge name={name} tone={tone} size="sm" />
        <span className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded-full border',
          active
            ? 'text-primary-light bg-primary/15 border-primary/30'
            : 'text-text-muted bg-white/[0.04] border-white/[0.08]'
        )}>
          {count}
        </span>
      </div>
      <p className={cn('text-sm font-semibold truncate', active ? 'text-primary-light' : 'text-text')} title={name}>{name}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wide -mt-2">{t('materi.folderFiles', { count })}</p>
    </motion.button>
  );
}