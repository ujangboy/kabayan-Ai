import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Globe, Bell, User as UserIcon, Check } from '@/icons';
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
  const [langOpen, setLangOpen] = useState(false);
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
    setLangOpen(false);
  };

  const initial = (profile?.name || profile?.username || 'U').charAt(0).toUpperCase();

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-surface/80 backdrop-blur-md z-10">
      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 flex-1 max-w-md px-3 py-2 rounded-lg bg-card border border-border text-text-muted hover:border-primary/40 transition-colors text-sm"
      >
        <Search size={15} />
        <span className="flex-1 text-left">{t('common.search')}</span>
        <kbd className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Language switcher */}
      <div className="relative">
        <button
          onClick={() => setLangOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
          title={t('settings.tabs.language')}
        >
          <Globe size={16} />
          <span className="uppercase text-xs font-semibold">{currentLang}</span>
        </button>
        {langOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
            <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-modal z-50 py-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLang(l.code)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors',
                    currentLang === l.code ? 'text-primary-light' : 'text-text-secondary hover:bg-background'
                  )}
                >
                  <span>{l.label}</span>
                  {currentLang === l.code && <Check size={14} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notifications (visual only — bell has no backend feed) */}
      <button
        onClick={() => navigate('/settings?tab=data')}
        className="relative p-2 rounded-lg text-text-secondary hover:bg-card hover:text-text transition-colors"
        title={t('common.notifications')}
      >
        <Bell size={18} />
      </button>

      {/* Profile */}
      <button
        onClick={() => navigate('/settings')}
        className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-semibold shadow-btn-primary hover:brightness-110 transition-all"
        title={profile?.name || profile?.username || 'User'}
      >
        {initial}
      </button>
    </header>
  );
}
