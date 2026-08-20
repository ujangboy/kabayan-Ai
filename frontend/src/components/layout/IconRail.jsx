import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useUiStore, useAppStore } from '@/store';
import { Tooltip } from '@/components/ui';
import {
  LayoutDashboard, MessageSquare, BookOpen, FileText,
  BookMarked, CreditCard, HelpCircle, Brain, Settings, Bot,
} from '@/icons';
import { cn } from '@/utils';

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function IconRail() {
  const { t } = useTranslation();
  const lastSubjectId = useUiStore((s) => s.lastSubjectId);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const location = useLocation();

  const NAV = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/chat', icon: MessageSquare, label: t('nav.chat') },
    { to: lastSubjectId ? `/subjects/${lastSubjectId}` : '/subjects', icon: BookOpen, label: t('nav.subjects') },
    { to: '/materi', icon: FileText, label: t('nav.materi') },
    { to: '/notebook', icon: BookMarked, label: t('nav.notebook') },
    { to: '/flashcard', icon: CreditCard, label: t('nav.flashcard') },
    { to: '/quiz', icon: HelpCircle, label: t('nav.quiz') },
    { to: '/exam-analyzer', icon: Brain, label: t('nav.exam') },
  ];

  const isActive = (to) => {
    if (to === '/exam-analyzer') return location.pathname === '/exam-analyzer';
    if (to.startsWith('/subjects')) return location.pathname.startsWith('/subjects');
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  const railItem = 'relative w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 group';

  return (
    <aside className="flex h-screen w-14 flex-col items-center bg-rail py-3 relative z-20 shrink-0 divider-gradient-r gap-1">
      {/* Logo */}
      <div className="relative mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-btn-primary">
        <span className="absolute inset-0 rounded-xl bg-gradient-primary opacity-50 blur-md" />
        <Bot size={20} className="relative text-white" />
      </div>

      {/* Search trigger */}
      <Tooltip label={t('common.search')} side="right">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-all duration-200 hover:bg-card hover:text-text"
        >
          <SearchGlyph />
        </button>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border shrink-0" />

      {/* Nav items */}
      <nav className="flex w-full flex-1 min-h-0 flex-col items-center gap-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, action }) => {
          const active = isActive(to);
          return (
            <Tooltip key={to} label={label} side="right">
              <NavLink to={to} onClick={action} className={railItem}>
                {active && (
                  <motion.span
                    layoutId="nav-active-indicator"
                    className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-gradient-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                    active ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
                  )}
                >
                  <Icon size={20} />
                </span>
              </NavLink>
            </Tooltip>
          );
        })}
      </nav>

      <div className="my-1 h-px w-8 bg-border shrink-0" />

      {/* Settings */}
      <Tooltip label={t('nav.settings')} side="right">
        <NavLink to="/settings" className={railItem}>
          {location.pathname.startsWith('/settings') && (
            <motion.span
              layoutId="nav-active-indicator"
              className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-gradient-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
              location.pathname.startsWith('/settings') ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
            )}
          >
            <Settings size={20} />
          </span>
        </NavLink>
      </Tooltip>
    </aside>
  );
}
