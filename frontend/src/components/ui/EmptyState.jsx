import { cn } from '@/utils';
import { Icon } from './Icon';
import { motion } from 'framer-motion';

export function EmptyState({ icon, title, description, action, className, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className
      )}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'relative mb-5 flex items-center justify-center rounded-lg bg-primary/10 text-primary-light border border-primary/15',
            compact ? 'h-12 w-12' : 'h-16 w-16'
          )}
        >
          <Icon name={icon} size={compact ? 22 : 28} />
        </motion.div>
      )}
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn('font-semibold text-text', compact ? 'text-sm' : 'text-base')}
      >
        {title}
      </motion.h3>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 max-w-xs text-sm text-text-muted"
        >
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}