import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAppStore, useChatStore, useUiStore } from '@/store';
import {
  LayoutDashboard, MessageSquare, BookOpen, FileText,
  BookMarked, CreditCard, HelpCircle,
  Settings, PanelOpen, PanelClose, Plus, Search, Bot, Brain
} from '@/icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils';

export default function Sidebar() {
  const { t } = useTranslation();
  const lastSubjectId = useUiStore((s) => s.lastSubjectId);
  const NAV = [
    { to: '/dashboard',     icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/chat',          icon: MessageSquare,   label: t('nav.chat') },
    { to: lastSubjectId ? `/subjects/${lastSubjectId}` : '/subjects', icon: BookOpen, label: t('nav.subjects') },
    { to: '/materi',        icon: FileText,        label: t('nav.materi') },
    { to: '/notebook',      icon: BookMarked,      label: t('nav.notebook') },
    { to: '/flashcard',     icon: CreditCard,      label: t('nav.flashcard') },
    { to: '/quiz',          icon: HelpCircle,      label: t('nav.quiz') },
    { to: '/exam-analyzer', icon: Brain,           label: t('nav.exam') },
  ];
  const { sidebarOpen, toggleSidebar, setSearchOpen } = useAppStore();
  const { createChat } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewChat = () => {
    const id = createChat();
    navigate(`/chat?id=${id}`);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 64 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex flex-col h-screen bg-gradient-to-b from-sidebar to-background border-r border-border shrink-0 overflow-hidden z-20"
    >
      {/* Logo — selalu tampil; saat collapsed hanya icon Bot */}
      <div className="relative flex flex-col items-center pt-4 pb-2 shrink-0 gap-1.5">
        <div className={cn(
          "rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-btn-primary transition-all duration-300",
          sidebarOpen ? "w-9 h-9" : "w-10 h-10"
        )}>
          <Bot size={sidebarOpen ? 18 : 20} className="text-white" />
        </div>
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="text-xs font-bold text-text tracking-wide">Kabayan AI</span>
              <span className="badge badge-primary text-[10px]">v2</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse toggle — selalu tampil, dipisah dari logo */}
      <div className="flex justify-center pb-2 shrink-0">
        <Tooltip
          label={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
          side="right"
          align="center"
        >
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-card hover:shadow-glow-sm transition-all duration-200 shrink-0"
            aria-label={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
          >
            {sidebarOpen
              ? <PanelOpen size={20} />
              : <PanelClose size={20} />}
          </button>
        </Tooltip>
      </div>

      {/* Divider */}
      <div className="mx-3 mb-2 border-t border-border shrink-0" />

      {/* Search */}
      <div className="px-3 mb-2 shrink-0">
        <Tooltip label="Cari" side="right" align="center">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "sidebar-item w-full",
              !sidebarOpen && "justify-center px-0"
            )}
            aria-label="Cari"
          >
            <Search size={sidebarOpen ? 16 : 20} className="shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 text-left text-xs text-text-muted"
                >
                  Cari... <kbd className="ml-1 text-[10px] bg-card border border-border px-1 rounded">⌘K</kbd>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Tooltip>
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-3 shrink-0">
        <Tooltip label="Chat Baru" side="right" align="center">
          <button
            onClick={handleNewChat}
            className={cn(
              "btn-primary w-full justify-center text-xs",
              !sidebarOpen && "px-0 py-2"
            )}
            aria-label="Chat Baru"
          >
            <Plus size={sidebarOpen ? 14 : 18} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Chat Baru
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Tooltip>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV.map(({ to, icon: Icon, label }) => {
          const isExam = to === '/exam-analyzer';
          return (
            <Tooltip key={to} label={!sidebarOpen ? label : undefined} side="right" align="center">
              <NavLink
                to={to}
                className={({ isActive }) => {
                  const active = isExam
                    ? isActive || location.pathname === '/study-plan'
                    : isActive;
                  return cn('sidebar-item relative', active && 'active', !sidebarOpen && 'justify-center px-0');
                }}
                title={!sidebarOpen ? label : undefined}
              >
                {({ isActive }) => {
                  const active = isExam
                    ? isActive || location.pathname === '/study-plan'
                    : isActive;
                  return (
                    <>
                      <Icon size={sidebarOpen ? 16 : 20} className="shrink-0" />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="whitespace-nowrap text-sm"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {/* Active indicator bar */}
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-primary"
                        />
                      )}
                    </>
                  );
                }}
              </NavLink>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom: Settings */}
      <div className="px-3 py-4 border-t border-border shrink-0">
        <Tooltip label={!sidebarOpen ? 'Pengaturan' : undefined} side="right" align="center">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn('sidebar-item relative', isActive && 'active', !sidebarOpen && 'justify-center px-0')
            }
            title={!sidebarOpen ? 'Pengaturan' : undefined}
          >
            {({ isActive }) => (
              <>
                <Settings size={sidebarOpen ? 16 : 20} className="shrink-0" />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                      Pengaturan
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-primary"
                  />
                )}
              </>
            )}
          </NavLink>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
