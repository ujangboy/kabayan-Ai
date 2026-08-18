/**
 * Global Toast System — Kabayan AI
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Flashcard berhasil disimpan');
 *   toast.error('Gagal mengunggah materi');
 *   toast.warning('Kuota AI hampir habis');
 *   toast.info('Proses sedang berjalan...');
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
  success: <CheckCircle  size={16} className="shrink-0 text-success" />,
  error:   <XCircle      size={16} className="shrink-0 text-danger"  />,
  warning: <AlertTriangle size={16} className="shrink-0 text-warning" />,
  info:    <Info          size={16} className="shrink-0 text-primary" />,
};

const BORDER = {
  success: 'border-success/30',
  error:   'border-danger/30',
  warning: 'border-warning/30',
  info:    'border-primary/30',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // max 5 visible
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, dur)  => show(msg, 'success', dur),
    error:   (msg, dur)  => show(msg, 'error',   dur ?? 6000),
    warning: (msg, dur)  => show(msg, 'warning', dur ?? 5000),
    info:    (msg, dur)  => show(msg, 'info',    dur),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
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
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
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
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 8,  scale: 0.97 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl
        bg-card border shadow-xl text-sm text-text ${BORDER[toast.type] || BORDER.info}`}
    >
      {ICONS[toast.type] || ICONS.info}
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded text-text-muted hover:text-text transition-colors"
        aria-label={t('common.close')}
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}
