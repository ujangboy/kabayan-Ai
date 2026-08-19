import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore, useAppStore, useChatStore } from '@/store';
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
  const createChat = useChatStore((s) => s.createChat);
  const navigate = useNavigate();
  const location = useLocation();

  const NAV = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/chat', icon: MessageSquare, label: t('nav.chat'), action: () => { const id = createChat(); navigate(`/chat?id=${id}`); } },
    { to: lastSubjectId ? `/subjects/${lastSubjectId}` : '/subjects', icon: BookOpen, label: t('nav.subjects') },
    { to: '/materi', icon: FileText, label: t('nav.materi') },
    { to: '/notebook', icon: BookMarked, label: t('nav.notebook') },
    { to: '/flashcard', icon: CreditCard, label: t('nav.flashcard') },
    { to: '/quiz', icon: HelpCircle, label: t('nav.quiz') },
    { to: '/exam-analyzer', icon: Brain, label: t('nav.exam') },
  ];

  const isActive = (to) => {
    if (to === '/exam-analyzer') return location.pathname === '/exam-analyzer' || location.pathname === '/study-plan';
    if (to.startsWith('/subjects')) return location.pathname.startsWith('/subjects');
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  return (
    <aside className="flex flex-col items-center w-14 h-screen bg-rail divider-gradient-r relative shrink-0 z-20 py-3 gap-1">
      {/* Logo */}
      <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-btn-primary mb-3 shrink-0">
        <Bot size={20} className="text-white" />
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        title={t('common.search')}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary hover:text-text hover:bg-card transition-all duration-200"
      >
        <SearchGlyph />
      </button>

      <div className="w-8 h-px bg-border my-1" />

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full">
        {NAV.map(({ to, icon: Icon, label, action }) => {
          const active = isActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={action}
              title={label}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group"
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-primary" />
              )}
              <span className={cn(
                'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
                active ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
              )}>
                <Icon size={20} />
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-border my-1" />

      {/* Settings */}
      <NavLink
        to="/settings"
        title={t('nav.settings')}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group"
      >
        {location.pathname.startsWith('/settings') && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-primary" />
        )}
        <span className={cn(
          'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
          location.pathname.startsWith('/settings') ? 'bg-primary/15 text-primary-light' : 'text-text-secondary group-hover:bg-card group-hover:text-text'
        )}>
          <Settings size={20} />
        </span>
      </NavLink>
    </aside>
  );
}
