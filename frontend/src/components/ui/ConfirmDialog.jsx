import { useTranslation } from 'react-i18next';
import { AlertTriangle } from '@/icons';
import { cn } from '@/utils';
import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  loading = false,
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} size="sm" bodyClassName="overflow-visible">
      <div className="p-5 text-center">
        {danger && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle size={24} className="text-danger" />
          </div>
        )}
        <h3 className="mb-2 text-lg font-bold text-text">{title}</h3>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
      <div className="flex border-t border-white/10">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          {cancelLabel || t('common.cancel', 'Batal')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'flex-1 border-l border-white/10 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50',
            danger
              ? 'bg-danger/5 text-danger hover:bg-danger/10'
              : 'bg-primary/5 text-primary hover:bg-primary/10'
          )}
        >
          {loading
            ? t('common.deleting', 'Menghapus...')
            : confirmLabel || t('common.delete', 'Hapus')}
        </button>
      </div>
    </Modal>
  );
}
