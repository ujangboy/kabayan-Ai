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
import { createContext, useContext, useState, useCallback, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { ICONS } from '@/lib/icons';
import { Button } from '@/components/ui';

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

const TOAST_ICON_MAP = {
  success: ICONS.status.success,
  error:   ICONS.status.error,
  warning: ICONS.status.warning,
  info:    ICONS.status.info,
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
  const dismissConfirm = useCallback(() => setConfirmState(null), []);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000, action = null) => {
    const id = ++counterRef.current;
    // Toast dengan aksi (mis. Undo) perlu waktu lebih lama agar bisa diklik.
    if (action && duration === 4000) duration = 7000;
    setToasts(prev => [...prev.slice(-3), { id, message, type, action }]); // max 4 visible
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const confirm = useCallback((opts) => {
    setConfirmState(opts || null);
  }, []);

  const toast = {
    success: (msg, dur)  => show(msg, 'success', dur ?? 6000),
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
      <ConfirmDialog state={confirmState} onClose={dismissConfirm} />
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
      className="fixed top-16 right-5 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
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
  const handleAction = () => {
    toast.action?.onClick?.();
    onDismiss(toast.id);
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.92, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, scale: 0.95, filter: 'blur(2px)' }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={`pointer-events-auto flex items-start gap-3 pl-3.5 pr-2.5 py-3 rounded-lg
        glass ring-1 ${RING[toast.type] || RING.info} ${GLOW[toast.type] || GLOW.info} text-base text-text`}
    >
      <span className="mt-0.5">
        <Icon name={TOAST_ICON_MAP[toast.type] || ICONS.status.info} size={17} className="shrink-0" />
      </span>
      <p className="flex-1 leading-snug text-meta">{toast.message}</p>
      {toast.action && (
        <button
          onClick={handleAction}
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary-light
            bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text hover:bg-card-hover transition-colors"
        aria-label={t('common.close')}
      >
        <Icon name={ICONS.actions.close} size={13} />
      </button>
    </motion.div>
  );
}

// ─── Confirm Dialog (pengganti browser confirm/alert) ────────────────────────
function ConfirmDialog({ state, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!state) return undefined;

    previousFocusRef.current = document.activeElement;
    const node = dialogRef.current;
    const focusables = node?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(
        node.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [state, onClose]);

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
        onClick={() => { if (!busy) onClose(); }}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm glass rounded-dialog p-6 shadow-modal border border-border outline-none"
        >
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              state.danger
                ? 'bg-danger/15 text-danger'
                : 'bg-primary-solid text-white shadow-card'
            }`}>
              {state.danger
                ? <Icon name={ICONS.status.warning} size={20} />
                : <Icon name={ICONS.status.info} size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id={titleId} className="text-base font-semibold text-text mb-1">
                {state.title || t('toast.confirmTitle')}
              </h3>
              <p id={descId} className="text-meta text-text-secondary leading-relaxed whitespace-pre-line">
                {state.message}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              onClick={() => { if (!busy) onClose(); }}
              disabled={busy}
              className="text-sm disabled:opacity-50"
             variant="ghost">
              {state.cancelLabel || t('common.cancel')}
            </Button>
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