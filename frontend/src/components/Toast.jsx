/**
 * Global Toast System — Kabayan AI (Apple-style)
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Flashcard berhasil disimpan');
 *   toast.error('Gagal mengunggah materi');
 *   toast.warning('Kuota AI hampir habis');
 *   toast.info('Proses sedang berjalan...');
 *   toast.confirm({ title, message, confirmLabel, danger, onConfirm });
 *
 * Provider:
 *   Wrap <App /> with <ToastProvider />.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from '@/icons';

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle  size={17} className="shrink-0 text-success" />,
  error:   <XCircle      size={17} className="shrink-0 text-danger"  />,
  warning: <AlertTriangle size={17} className="shrink-0 text-warning" />,
  info:    <Info          size={17} className="shrink-0 text-primary-light" />,
};

const GLOW = {
  success: 'shadow-[0_8px_24px_rgba(16,185,129,0.15)]',
  error:   'shadow-[0_8px_24px_rgba(239,68,68,0.15)]',
  warning: 'shadow-[0_8px_24px_rgba(245,158,11,0.15)]',
  info:    'shadow-[0_8px_24px_rgba(124,58,237,0.15)]',
};

const RING = {
  success: 'ring-success/20',
  error:   'ring-danger/20',
  warning: 'ring-warning/20',
  info:    'ring-primary/20',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev.slice(-3), { id, message, type }]); // max 4 visible
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const confirm = useCallback((opts) => {
    setConfirmState(opts || null);
  }, []);

  const toast = {
    success: (msg, dur)  => show(msg, 'success', dur),
    error:   (msg, dur)  => show(msg, 'error',   dur ?? 6000),
    warning: (msg, dur)  => show(msg, 'warning', dur ?? 5000),
    info:    (msg, dur)  => show(msg, 'info',    dur),
    dismiss,
    confirm,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return { toast: ctx };
}

// ─── Container ────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Single toast ─────────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const { t } = useTranslation();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.92, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(2px)' }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={`pointer-events-auto flex items-start gap-3 pl-3.5 pr-2.5 py-3 rounded-2xl
        glass ring-1 ${RING[toast.type] || RING.info} ${GLOW[toast.type] || GLOW.info} text-sm text-text`}
    >
      <span className="mt-0.5">{ICONS[toast.type] || ICONS.info}</span>
      <p className="flex-1 leading-snug text-[13px]">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text hover:bg-card-hover transition-colors"
        aria-label={t('common.close')}
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ─── Confirm Dialog (pengganti browser confirm/alert) ────────────────────────
function ConfirmDialog({ state, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await state.onConfirm?.();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm glass rounded-dialog p-6 shadow-modal border border-border"
        >
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              state.danger
                ? 'bg-danger/15 text-danger'
                : 'bg-gradient-primary text-white shadow-btn-primary'
            }`}>
              {state.danger
                ? <Warning size={20} />
                : <Info size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text mb-1">
                {state.title || t('toast.confirmTitle')}
              </h3>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                {state.message}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              disabled={busy}
              className="btn-ghost text-sm disabled:opacity-50"
            >
              {state.cancelLabel || t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className={state.danger
                ? 'inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-danger text-white text-sm font-medium hover:bg-danger/90 active:scale-95 transition-all duration-200 disabled:opacity-50'
                : 'btn-primary text-sm disabled:opacity-50'}
            >
              {state.confirmLabel || t('common.confirm')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
