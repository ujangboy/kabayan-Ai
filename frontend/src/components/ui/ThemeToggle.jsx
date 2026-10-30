import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeId, toggleDefaultTheme } from '@/lib/theme';
import { findTheme } from '@/lib/themes';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export const ThemeToggle = forwardRef(function ThemeToggle({ className = '', ...props }, ref) {
  const { t } = useTranslation();
  // Sumber state = data-theme di <html> (subscribes event 'kabayan-theme')
  // agar selalu sinkron dgn tema yang dipilih dari Settings → Tampilan.
  const themeId = useThemeId();
  const isDark = findTheme(themeId)?.mode !== 'light';

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        toggleDefaultTheme();
      }}
      className={`relative z-[11] rounded-xl p-2 text-text-secondary transition-[background-color,color] duration-150 hover:bg-wash hover:text-text active:scale-[0.98] ${className}`}
      aria-label={isDark ? t('settings.themeSwitchToLight') : t('settings.themeSwitchToDark')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
});
