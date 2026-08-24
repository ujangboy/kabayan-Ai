import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip } from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';

import { profileAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';
import { cn } from '@/utils';

const LANGS = [
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'su', label: 'Sundanese', flag: '🌿' },
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

  const displayName = profile?.name || profile?.username || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const [notifOn, setNotifOn] = useState(true);

  return (
    <header className="divider-gradient-b relative z-10 flex h-14 shrink-0 items-center gap-3 bg-surface px-4">

      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
        title={t('common.menu')}
      >
        <Icon name={ICONS.actions.menu} size={20} />
      </button>

      {/* Desktop: toggle collapse sidebar */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={toggleCollapsed}
        className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-text-secondary hover:text-text hover:bg-card-hover hover:border-border/80 transition-all duration-150 text-xs font-medium shrink-0"
        title={collapsed ? t('sidebar.expand', 'Tampilkan sidebar') : t('sidebar.collapse', 'Sembunyikan sidebar')}
        aria-label="Toggle sidebar"
        aria-expanded={!collapsed}
      >
        <Icon name={collapsed ? ICONS.actions.menuOpen : ICONS.actions.menu} size={16} />
        <span className="hidden xl:inline">{collapsed ? t('sidebar.expand', 'Tampilkan') : t('sidebar.collapse', 'Sembunyikan')}</span>
      </motion.button>

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
        <DropdownMenu.Trigger asChild>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
            title={t('settings.quickSettings')}
            aria-label={t('settings.quickSettings')}
          >
            <Icon name={ICONS.nav.settings} size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={8}
            align="end"
            className="z-50 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-glass-lg"
          >
            <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {t('settings.tabs.language')}
            </p>
            {LANGS.map((l) => (
              <DropdownMenu.Item
                key={l.code}
                onSelect={() => switchLang(l.code)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-all duration-100',
                  currentLang === l.code
                    ? 'bg-primary/10 text-primary-light'
                    : 'text-text-secondary hover:bg-card-hover hover:text-text'
                )}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {currentLang === l.code && <Icon name={ICONS.status.check} size={14} />}
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

      {/* Keyboard shortcuts */}
      <Tooltip label={t('shortcuts.title')}>
        <button
          onClick={() => setShortcutsOpen(true)}
          className="rounded-xl p-2 text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
          aria-label={t('shortcuts.title')}
        >
          <Icon name={ICONS.ui.help} size={18} />
        </button>
      </Tooltip>

      {/* Notifications bell */}
      <Tooltip label={t('common.notifications')}>
        <button
          onClick={() => navigate('/settings?tab=data')}
          className="relative rounded-xl p-2 text-text-secondary transition-all duration-150 hover:bg-card hover:text-text"
          aria-label={t('common.notifications')}
        >
          <Icon name={ICONS.ui.bell} size={18} />
        </button>
      </Tooltip>

      {/* Profile avatar */}
      <Tooltip label={displayName}>
        <button
          onClick={() => navigate('/settings')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-btn-primary transition-all duration-150 hover:bg-primary-hover hover:shadow-glow-sm active:scale-95"
          title={displayName}
        >
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
            : initial
          }
        </button>
      </Tooltip>
    </header>
  );
}