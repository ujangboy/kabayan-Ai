import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip, ThemeToggle } from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';

import { profileAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';
import { cn } from '@/utils';
import { springWave } from '@/lib/motion';
import { DEFAULT_AVATAR } from '@/components/settings/ProfileTab';

const LANGS = [
  { code: 'id', label: 'Indonesia', short: 'ID' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'su', label: 'Sundanese', short: 'SU' },
];

export default function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const collapsed = useAppStore((s) => s.collapsed);
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.get().then((r) => r.data),
  });

  const langMutation = useMutation({
    mutationFn: (lang) => profileAPI.update({ language: lang }),
    onSuccess: () => queryClient.invalidateQueries(['profile']),
  });

  const currentLang = i18n.language || 'id';

  const switchLang = (code) => {
    setAppLanguage(code);
    localStorage.setItem(STORAGE_KEY, code);
    langMutation.mutate(code);
  };

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const displayName = profile?.display_name || profile?.name || profile?.username || 'User';
  const photoPath = profile?.photo_path || DEFAULT_AVATAR;
  const [notifOn, setNotifOn] = useState(true);

  return (
    <header className="divider-gradient-b relative z-10 flex h-14 shrink-0 items-center gap-3 bg-surface px-4">

      {/* Mobile sidebar toggle */}
      <Tooltip label={t('common.menu')} side="bottom">
        <button
          onClick={toggleSidebar}
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
          aria-label={t('common.menu')}
        >
          <Icon name={ICONS.actions.menu} size={20} />
        </button>
      </Tooltip>

      {/* Desktop: toggle collapse sidebar (Removed because it's redundant with the sidebar logo toggle) */}

      {/* Search bar */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex max-w-md flex-1 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-text-muted transition-all duration-200 hover:border-primary/30 hover:bg-card-hover group"
      >
        <Icon name={ICONS.actions.search} size={15} className="shrink-0 group-hover:text-primary-light transition-colors duration-150" />
        <span className="flex-1 text-left truncate">{t('common.searchPlaceholder', 'Cari materi, flashcard, quiz...')}</span>
        <kbd className="hidden sm:inline rounded-md border border-border bg-background px-1.5 py-0.5 text-3xs font-mono">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Quick settings dropdown */}
      <DropdownMenu.Root>
        <Tooltip label={t('settings.quickSettings')} side="bottom">
          <DropdownMenu.Trigger
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
            aria-label={t('settings.quickSettings')}
          >
            <Icon name={ICONS.nav.settings} size={18} />
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={8}
            align="end"
            className="z-50 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-modal"
          >
            <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {t('settings.tabs.language')}
            </p>
            {LANGS.map((l) => (
              <DropdownMenu.Item
                key={l.code}
                onSelect={() => switchLang(l.code)}
                className={cn(
                  'relative overflow-hidden flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-all duration-100',
                  currentLang === l.code
                    ? 'text-primary-light'
                    : 'text-text-secondary hover:bg-card-hover hover:text-text'
                )}
              >
                {currentLang === l.code && (
                  <motion.span
                    layoutId="quick-lang-indicator"
                    transition={springWave}
                    className="absolute inset-0 bg-primary/10 rounded-xl"
                  />
                )}
                <span className="relative text-xs font-bold text-text-muted w-6 text-center">{l.short}</span>
                <span className="relative flex-1">{l.label}</span>
                {currentLang === l.code && <Icon name={ICONS.status.check} size={14} className="relative" />}
              </DropdownMenu.Item>
            ))}

            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

            <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {t('common.notifications')}
            </p>
            <DropdownMenu.Item
              onSelect={(e) => { e.preventDefault(); setNotifOn((v) => !v); }}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm outline-none transition-all duration-100 text-text-secondary hover:bg-card-hover hover:text-text"
            >
              <span>{t('settings.notifications')}</span>
              <span className={cn(
                'w-7 h-4 rounded-full relative transition-colors duration-200',
                notifOn ? 'bg-primary' : 'bg-card-hover'
              )}>
                <span className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm',
                  notifOn ? 'translate-x-3.5' : 'translate-x-0.5'
                )} />
              </span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

            <DropdownMenu.Item
              onSelect={() => navigate('/settings')}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-all duration-100 text-text-secondary hover:bg-card-hover hover:text-text"
            >
              <Icon name={ICONS.nav.settings} size={15} />
              {t('settings.fullSettings')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Theme toggle */}
      <Tooltip label={isDark ? t('settings.themeLight') : t('settings.themeDark')} side="bottom">
        <ThemeToggle />
      </Tooltip>

      {/* Keyboard shortcuts */}
      <Tooltip label={t('shortcuts.title')} side="bottom">
        <button
          onClick={() => setShortcutsOpen(true)}
          className="rounded-xl p-2 text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
          aria-label={t('shortcuts.title')}
        >
          <Icon name={ICONS.ui.help} size={18} />
        </button>
      </Tooltip>

      {/* Notifications bell */}
      <Tooltip label={t('common.notifications')} side="bottom">
        <button
          onClick={() => navigate('/settings?tab=data')}
          className="relative rounded-xl p-2 text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
          aria-label={t('common.notifications')}
        >
          <Icon name={ICONS.ui.bell} size={18} />
        </button>
      </Tooltip>

      {/* Profile avatar */}
      <Tooltip label={displayName} side="bottom">
        <button
          onClick={() => navigate('/settings')}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white shadow-card transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
          aria-label={displayName}
        >
          <img
            src={photoPath}
            alt={displayName}
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            className="w-full h-full rounded-full object-cover"
          />
        </button>
      </Tooltip>
    </header>
  );
}