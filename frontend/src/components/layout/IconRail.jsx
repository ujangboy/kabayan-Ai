import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUiStore, useAppStore } from '@/store';
import { Tooltip, Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';

export default function IconRail() {
  const { t } = useTranslation();
  const lastSubjectId = useUiStore((s) => s.lastSubjectId);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const contextCollapsed = useAppStore((s) => s.contextSidebarCollapsed);
  const toggleContextSidebar = useAppStore((s) => s.toggleContextSidebar);
  const location = useLocation();

  const hasContextSidebar = ['/materi', '/subjects', '/flashcard'].some((p) =>
    location.pathname.startsWith(p)
  );

  const NAV = [
    { to: '/dashboard', icon: ICONS.nav.dashboard, label: t('nav.dashboard') },
    { to: '/chat', icon: ICONS.nav.chat, label: t('nav.chat') },
    { to: lastSubjectId ? `/subjects/${lastSubjectId}` : '/subjects', icon: ICONS.nav.subjects, label: t('nav.subjects') },
    { to: '/materi', icon: ICONS.nav.materials, label: t('nav.materi') },
    { to: '/notebook', icon: ICONS.nav.notebook, label: t('nav.notebook') },
    { to: '/flashcard', icon: ICONS.nav.flashcard, label: t('nav.flashcard') },
    { to: '/quiz', icon: ICONS.nav.quiz, label: t('nav.quiz') },
    { to: '/exam-analyzer', icon: ICONS.nav.exam, label: t('nav.exam') },
  ];

  const isActive = (to) => {
    if (to === '/exam-analyzer') return location.pathname === '/exam-analyzer';
    if (to.startsWith('/subjects')) return location.pathname.startsWith('/subjects');
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  const railItem = 'relative w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 group';

  return (
    <aside className="flex h-screen w-14 flex-col items-center bg-rail py-3 relative z-20 shrink-0 divider-gradient-r gap-1">
      {/* Logo + slide bar toggle nav menu (hanya di halaman dengan context sidebar) */}
      <div className="flex flex-col items-center gap-1.5 mb-2">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-btn-primary">
          <span className="absolute inset-0 rounded-xl bg-primary opacity-50 blur-md" />
          <Icon name={ICONS.communication.bot} size={20} className="relative text-white" />
        </div>
        {hasContextSidebar && (
          <Tooltip label={contextCollapsed ? t('common.expand', 'Tampilkan sidebar') : t('common.collapse', 'Sembunyikan sidebar')} side="right">
            <button
              onClick={toggleContextSidebar}
              aria-label={contextCollapsed ? t('common.expand', 'Tampilkan sidebar') : t('common.collapse', 'Sembunyikan sidebar')}
              aria-expanded={!contextCollapsed}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all duration-200 shadow-sm"
            >
              <Icon name={contextCollapsed ? ICONS.actions.panelLeft : ICONS.actions.panelLeftClose} size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Search trigger */}
      <Tooltip label={t('common.search')} side="right">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label={t('common.search')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-all duration-200 hover:bg-card hover:text-text"
        >
          <Icon name={ICONS.actions.search} size={20} />
        </button>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border shrink-0" />

      {/* Nav items */}
      <nav className="flex w-full flex-1 min-h-0 flex-col items-center gap-1 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => {
          const active = isActive(to);
          return (
            <Tooltip key={to} label={label} side="right">
              <NavLink to={to} className={railItem} aria-label={label}>
                {active && (
                  <motion.span
                    layoutId="nav-active-indicator"
                    className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                    active ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
                  )}
                >
                  <Icon name={icon} size={20} />
                </span>
              </NavLink>
            </Tooltip>
          );
        })}
      </nav>

      <div className="my-1 h-px w-8 bg-border shrink-0" />

      {/* Settings */}
      <Tooltip label={t('nav.settings')} side="right">
        <NavLink to="/settings" className={railItem} aria-label={t('nav.settings')}>
          {location.pathname.startsWith('/settings') && (
            <motion.span
              layoutId="nav-active-indicator"
              className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
              location.pathname.startsWith('/settings') ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
            )}
          >
            <Icon name={ICONS.nav.settings} size={20} />
          </span>
        </NavLink>
      </Tooltip>
    </aside>
  );
}