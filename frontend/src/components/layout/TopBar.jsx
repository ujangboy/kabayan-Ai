import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { profileAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';
import { cn } from '@/utils';

const LANGS = [
  { code: 'id', label: 'Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'su', label: 'Sundanese' },
];

export default function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
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

  const initial = (profile?.name || profile?.username || 'U').charAt(0).toUpperCase();
  const [notifOn, setNotifOn] = useState(true);

  return (
    <header className="divider-gradient-b relative z-10 flex h-14 shrink-0 items-center gap-3 bg-surface/80 px-4 backdrop-blur-md">
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-card hover:text-text"
        title={t('common.menu')}
      >
        <Icon name={ICONS.actions.menu} size={20} />
      </button>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-muted transition-colors hover:border-primary/40"
      >
        <Icon name={ICONS.actions.search} size={15} />
        <span className="flex-1 text-left">{t('common.search')}</span>
        <kbd className="hidden sm:inline rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Quick settings (Option B PRD-01): bahasa + notifikasi + link settings penuh */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-card hover:text-text"
            title={t('settings.quickSettings')}
            aria-label={t('settings.quickSettings')}
          >
            <Icon name={ICONS.nav.settings} size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="end"
            className="z-50 w-52 rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-glass-lg backdrop-blur-md"
          >
            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
              {t('settings.tabs.language')}
            </p>
            {LANGS.map((l) => (
              <DropdownMenu.Item
                key={l.code}
                onSelect={() => switchLang(l.code)}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none transition-colors',
                  currentLang === l.code
                    ? 'text-primary-light'
                    : 'text-text-secondary hover:bg-background'
                )}
              >
                <span>{l.label}</span>
                {currentLang === l.code && <Icon name={ICONS.status.check} size={14} />}
              </DropdownMenu.Item>
            ))}

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
              {t('common.notifications')}
            </p>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setNotifOn((v) => !v);
              }}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none transition-colors text-text-secondary hover:bg-background"
            >
              <span>{t('settings.notifications')}</span>
              <Icon name={notifOn ? ICONS.status.check : ICONS.actions.close} size={14} />
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <DropdownMenu.Item
              onSelect={() => navigate('/settings')}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors text-text-secondary hover:bg-background"
            >
              <Icon name={ICONS.nav.settings} size={15} />
              {t('settings.fullSettings')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Keyboard shortcuts */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-card hover:text-text"
        title={t('shortcuts.title')}
        aria-label={t('shortcuts.title')}
      >
        <Icon name={ICONS.ui.help} size={18} />
      </button>

      {/* Notifications (visual only — bell has no backend feed) */}
      <button
        onClick={() => navigate('/settings?tab=data')}
        className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-card hover:text-text"
        title={t('common.notifications')}
      >
        <Icon name={ICONS.ui.bell} size={18} />
      </button>

      {/* Profile */}
      <button
        onClick={() => navigate('/settings')}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-white shadow-btn-primary transition-all hover:brightness-110"
        title={profile?.name || profile?.username || 'User'}
      >
        {initial}
      </button>
    </header>
  );
}
