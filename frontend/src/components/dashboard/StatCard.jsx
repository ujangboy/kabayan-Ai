import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';

export default function StatCard({ icon, label, value, color = 'text-text', suffix = '' }) {
  const bgClass = color.replace('text-', 'bg-');
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base card-hoverable p-4 flex items-center gap-3"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgClass}/10`}>
        <Icon name={icon} size={16} className={color} />
      </div>
      <div>
        <p className="text-xl font-bold bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">
          {value != null ? value : '—'}
          {suffix && <span className="text-xs text-text-muted font-normal ml-0.5">{suffix}</span>}
        </p>
        <p className="text-[10px] text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}