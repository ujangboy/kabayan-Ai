import { useBackNavigation } from '@/hooks/useBackNavigation';
import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';
import PageHeaderBack from '@/components/ui/PageHeaderBack';

/**
 * BackButton — tombol back terpadu (PRD-01 §6.2), delegasi ke PageHeaderBack.
 *
 * Logika tujuan back (`?from=` → referrer → route induk → fallback) ditangani
 * oleh `useBackNavigation`. Komponen ini mempertahankan API lama:
 *   - `label` kustom → selalu tampil (walau tidak ada tujuan back bermakna).
 *   - tanpa `label` → otomatis disembunyikan bila tidak ada tujuan back.
 *
 * @param {Object} props
 * @param {string} [props.fallback='/dashboard'] Tujuan akhir tanpa jalur lain.
 * @param {string} [props.label] Label kustom; bila diisi, tombol selalu tampil.
 * @param {string} [props.className] Class tambahan.
 */
export default function BackButton({ fallback = '/dashboard', label, className }) {
  const { back, canGoBack } = useBackNavigation({ fallback });

  // Label kustom selalu ditampilkan (mis. "Batal").
  if (label) {
    return (
      <button
        type="button"
        onClick={back}
        className={cn('btn-ghost px-3 py-2 rounded-xl text-sm', className)}
      >
        <Icon name={ICONS.actions.back} size={16} /> {label}
      </button>
    );
  }

  if (!canGoBack) return null;
  return <PageHeaderBack className={className} />;
}
