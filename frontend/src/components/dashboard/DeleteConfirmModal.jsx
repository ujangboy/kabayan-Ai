import { motion } from 'framer-motion';
import { AlertTriangle, X } from '@/icons';
import { useTranslation } from 'react-i18next';

export default function DeleteConfirmModal({ title, message, onConfirm, onCancel, isDeleting }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
        <div className="flex border-t border-border">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 text-sm font-medium text-text-secondary hover:bg-background transition-colors disabled:opacity-50"
          >
            {t('common.cancel', 'Batal')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 text-sm font-medium text-danger bg-danger/5 hover:bg-danger/10 border-l border-border transition-colors disabled:opacity-50"
          >
            {isDeleting ? t('common.deleting', 'Menghapus...') : t('common.delete', 'Hapus')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
