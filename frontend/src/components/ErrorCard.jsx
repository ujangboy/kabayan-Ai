/**
 * ErrorCard — friendly error display with optional retry button.
 * Never shows raw exceptions, stack traces, or technical details.
 *
 * Usage:
 *   <ErrorCard message="Gagal membuat blueprint." onRetry={handleRetry} />
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorCard({
  title   = 'Terjadi Kesalahan',
  message = 'Kabayan AI mengalami masalah. Silakan coba beberapa saat lagi.',
  onRetry = null,
  className = '',
}) {
  return (
    <div className={`card-base p-8 text-center border-danger/20 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={22} className="text-danger" />
      </div>
      <h3 className="font-semibold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-secondary mb-5 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-text hover:border-primary/40 transition-colors"
        >
          <RefreshCw size={14} /> Coba Lagi
        </button>
      )}
    </div>
  );
}
