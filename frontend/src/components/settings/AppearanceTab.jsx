import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { THEMES } from '@/lib/themes';
import { useThemeId, applyTheme } from '@/lib/theme';
import { cn } from '@/utils';

export default function AppearanceTab() {
  const { t } = useTranslation();
  const themeId = useThemeId();

  return (
    <div className="card-base p-6 max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text">{t('settings.appearance.title')}</h2>
        <p className="text-text-secondary text-sm mt-0.5">{t('settings.appearance.subtitle')}</p>
      </div>

      {/* role=group agar pembaca layar menyebutnya satu pilihan tema */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="group" aria-label={t('settings.appearance.title')}>
        {THEMES.map((theme) => {
          const active = themeId === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => applyTheme(theme.id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border text-left option-row',
                active
                  ? 'border-primary bg-primary/10 text-primary-light'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {/* Preview mini — window: kanvas + panel surface + titik accent */}
              <span
                aria-hidden
                className="relative shrink-0 w-12 h-9 rounded-lg border border-strong overflow-hidden"
                style={{ background: theme.preview.bg }}
              >
                <span
                  className="absolute left-1.5 right-1.5 top-1.5 h-3.5 rounded"
                  style={{ background: theme.preview.surface }}
                />
                <span
                  className="absolute left-1.5 bottom-1.5 w-3.5 h-1.5 rounded-full"
                  style={{ background: theme.preview.accent }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text truncate">{theme.label}</span>
                <span className="block text-xs text-text-muted">
                  {theme.mode === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
                </span>
              </span>
              <Icon
                name={ICONS.status.check}
                size={16}
                className={cn('ml-auto shrink-0', active ? 'text-primary' : 'invisible')}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
