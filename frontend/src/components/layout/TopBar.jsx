import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Search, Globe, Bell, Check } from '@/icons';
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

  return (
    <header className="divider-gradient-b relative z-10 flex h-14 shrink-0 items-center gap-3 bg-surface/80 px-4 backdrop-blur-md">
      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-muted transition-colors hover:border-primary/40"
      >
        <Search size={15} />
        <span className="flex-1 text-left">{t('common.search')}</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Language switcher */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-card hover:text-text"
            title={t('settings.tabs.language')}
          >
            <Globe size={16} />
            <span className="text-xs font-semibold uppercase">{currentLang}</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="end"
            className="z-50 w-44 rounded-lg border border-border bg-card p-1 shadow-modal"
          >
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
                {currentLang === l.code && <Check size={14} />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Notifications (visual only — bell has no backend feed) */}
      <button
        onClick={() => navigate('/settings?tab=data')}
        className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-card hover:text-text"
        title={t('common.notifications')}
      >
        <Bell size={18} />
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
