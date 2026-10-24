import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
import { KabayanMark } from '@/components/brand/KabayanLogo';
import { DEFAULT_AVATAR } from '@/components/settings/ProfileTab';

const LANGS = [
  { code: 'id', label: 'Indonesia', short: 'ID' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'su', label: 'Sundanese', short: 'SU' },
];

const SEARCH_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl K';

export default function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
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

  return (
    <header className="divider-gradient-b relative z-10 flex h-16 shrink-0 items-center gap-3 bg-surface/95 px-4 backdrop-blur-xl">

      {/* Mobile sidebar toggle + brand */}
      <Tooltip label={t('common.menu')} side="bottom">
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-wash hover:text-text lg:hidden"
          aria-label={t('common.menu')}
        >
          <Icon name={ICONS.actions.menu} size={20} />
        </button>
      </Tooltip>
      <NavLink to="/dashboard" className="shrink-0 lg:hidden" aria-label="Kabayan Pintar">
        <KabayanMark size={30} />
      </NavLink>

      {/* Search bar */}
      <button
        onClick={() => setSearchOpen(true)}
        aria-label={t('common.search')}
        className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent bg-subtle text-sm text-text-muted transition-all duration-200 hover:border-border hover:bg-surface hover:shadow-card sm:w-auto sm:max-w-lg sm:flex-1 sm:justify-start sm:gap-2.5 sm:px-3.5"
      >
        <Icon name={ICONS.actions.search} size={16} className="shrink-0 transition-colors duration-150 group-hover:text-primary-light" />
        <span className="hidden flex-1 truncate text-left sm:block">{t('common.searchPlaceholder', 'Cari materi, flashcard, quiz...')}</span>
        <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-3xs font-medium text-text-muted sm:inline">{SEARCH_SHORTCUT}</kbd>
      </button>

      <div className="flex-1" />

      {/* Quick settings dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Tooltip label={t('settings.quickSettings')} side="bottom">
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-wash hover:text-text sm:flex"
              aria-label={t('settings.quickSettings')}
            >
              <Icon name={ICONS.nav.settings} size={18} />
            </button>
          </Tooltip>
        </DropdownMenu.Trigger>
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
      <Tooltip label={isDark ? t('settings.themeSwitchToLight') : t('settings.themeSwitchToDark')} side="bottom">
        <ThemeToggle />
      </Tooltip>

      {/* Profile avatar */}
      <Tooltip label={displayName} side="bottom">
        <button
          onClick={() => navigate('/settings')}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary-solid text-sm font-semibold text-white shadow-card transition-all duration-150 hover:bg-primary-solid-hover active:scale-[0.98]"
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