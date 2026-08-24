import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';

export default function StatCard({ icon, label, value, color = 'text-slate-200', suffix = '' }) {
  const bgClass = color.replace('text-', 'bg-');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgClass}/15 border border-white/5`}>
        <Icon name={icon} size={15} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none text-white">
          {value != null ? value : '—'}
          {suffix && <span className="text-xs text-slate-400 font-normal ml-0.5">{suffix}</span>}
        </p>
        <p className="text-2xs text-slate-400 mt-0.5 truncate">{label}</p>
      </div>
    </motion.div>
  );
}