import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '@/icons';

// Focus Mode (PRD US5.2) — overlay fullscreen yang menyembunyikan sidebar/nav.
// Tombol keluar sengaja disembunyikan (muncul saat mouse bergerak); Esc selalu berfungsi.
export default function FocusModeView({ activity, onExit, children }) {
  const { t } = useTranslation();
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const handleMouseMove = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setControlsVisible(false)}
    >
      {/* Top bar — label aktivitas + tombol keluar (muncul saat hover/mouse bergerak) */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/60">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className="badge badge-primary text-[10px] shrink-0">{t('focusMode.title')}</span>
          <span className="text-xs font-semibold text-text truncate">
            {activity?.label || t('focusMode.activity')}
          </span>
        </div>
        <button
          onClick={onExit}
          title={t('focusMode.exit')}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-card hover:text-danger border border-border transition-all duration-300 cursor-pointer ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <X size={14} />
          {t('focusMode.exit')}
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">{children}</div>
      <p className="absolute bottom-2 right-3 text-[10px] text-text-muted select-none">{t('focusMode.exitHint')}</p>
    </div>
  );
}
