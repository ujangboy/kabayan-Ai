import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';

export default function StatCard({ icon, label, value, color = 'text-text', suffix = '' }) {
  const bgClass = color.replace('text-', 'bg-');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgClass}/15 border border-border`}>
        <Icon name={icon} size={15} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none text-white">
          {value != null ? value : '—'}
          {suffix && <span className="text-xs text-text-secondary font-normal ml-0.5">{suffix}</span>}
        </p>
        <p className="text-2xs text-text-secondary mt-0.5 truncate">{label}</p>
      </div>
    </motion.div>
  );
}