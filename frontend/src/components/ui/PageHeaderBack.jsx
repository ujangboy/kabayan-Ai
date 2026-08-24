import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { useBackNavigation, getRouteLabel } from '@/hooks/useBackNavigation';
import { cn } from '@/utils';

/**
 * PageHeaderBack — tombol "Kembali ke [Parent]" terstandarisasi (PRD §2.C).
 *
 * Terletak di kiri atas konten untuk halaman level-2 ke atas. Menampilkan
 * micro-interaction: ikon bergeser 2px ke kiri saat hover. Tidak me-reset
 * filter karena navigate() mempertahankan history/query string tujuan.
 */
export default function PageHeaderBack({ className = '' }) {
  const { t } = useTranslation();
  const { canGoBack, destination, back } = useBackNavigation();
  if (!canGoBack) return null;

  const parentName = getRouteLabel(destination, t);

  return (
    <motion.button
      type="button"
      onClick={back}
      aria-label={t('back.ariaLabel', { name: parentName })}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium',
        'text-text-secondary transition-colors hover:bg-card hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
    >
      <motion.span
        className="inline-flex"
        whileHover={{ x: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <Icon name={ICONS.actions.back} size={18} />
      </motion.span>
      <span>{t('back.label', { name: parentName })}</span>
    </motion.button>
  );
}