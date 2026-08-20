import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { resolveBackDestination } from '@/hooks/useBackNavigation';
import { cn } from '@/utils';

// Label dinamis tombol back: prefix route → key i18n nama halaman.
const DEST_LABELS = [
  ['/subjects', 'nav.subjects'],
  ['/materi', 'nav.materi'],
  ['/flashcard', 'nav.flashcard'],
  ['/quiz', 'nav.quiz'],
  ['/exam-analyzer', 'nav.exam'],
  ['/study-plan', 'nav.studyPlan'],
  ['/notebook', 'nav.notebook'],
  ['/chat', 'nav.chat'],
  ['/dashboard', 'nav.dashboard'],
  ['/settings', 'nav.settings'],
];

/**
 * BackButton — tombol back terpadu (PRD-01 §6.2).
 *
 * Menggunakan useBackNavigation di balik layar: `?from=` → referrer →
 * route induk → fallback. Label otomatis mengikuti tujuan ("Kembali ke Mata
 * Kuliah", "Kembali ke Dashboard", dst), atau bisa di-override via `label`.
 *
 * @param {Object} props
 * @param {string} [props.fallback='/dashboard'] Tujuan akhir tanpa jalur lain.
 * @param {string} [props.label] Label kustom; bila diisi, tombol selalu tampil.
 * @param {string} [props.className] Class tambahan.
 */
export default function BackButton({ fallback = '/dashboard', label, className }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const destination = resolveBackDestination({
    pathname,
    searchParams,
    referrer: document.referrer,
    fallback,
  });

  const pageLabel = () => {
    for (const [prefix, key] of DEST_LABELS) {
      if (destination.startsWith(prefix)) return t(key);
    }
    return null;
  };

  // Tanpa label kustom: sembunyikan bila tujuan = fallback (tidak ada back
  // yang bermakna); tampilkan label dinamis bila ada tujuan spesifik.
  const shown = label ?? (destination !== fallback ? t('backButton.to', { page: pageLabel() ?? t('common.back') }) : null);
  if (shown == null) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(destination)}
      className={cn('btn-ghost px-3 py-2 rounded-xl text-sm', className)}
    >
      <Icon name={ICONS.actions.back} size={16} /> {shown}
    </button>
  );
}