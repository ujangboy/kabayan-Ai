import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAppStore, useChatStore } from '@/store';
import {
  LayoutDashboard, MessageSquare, BookOpen, FileText,
  BookMarked, CreditCard, HelpCircle,
  Settings, ChevronLeft, Plus, Search, Bot, Brain, History
} from 'lucide-react';
import { cn } from '@/utils';

export default function Sidebar() {
  const { t } = useTranslation();
  const NAV = [
    { to: '/dashboard',     icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/chat',          icon: MessageSquare,   label: t('nav.chat') },
    { to: '/subjects',      icon: BookOpen,        label: t('nav.subjects') },
    { to: '/materi',        icon: FileText,        label: t('nav.materi') },
    { to: '/notebook',      icon: BookMarked,      label: t('nav.notebook') },
    { to: '/flashcard',     icon: CreditCard,      label: t('nav.flashcard') },
    { to: '/quiz',          icon: HelpCircle,      label: t('nav.quiz') },
    { to: '/exam-analyzer', icon: Brain,           label: t('nav.exam') },
  ];
  const { sidebarOpen, toggleSidebar, setSearchOpen } = useAppStore();
  const { createChat } = useChatStore();
  const navigate = useNavigate();

  const handleNewChat = () => {
    const id = createChat();
    navigate(`/chat?id=${id}`);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 64 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen bg-sidebar border-r border-border shrink-0 overflow-hidden z-20"
    >
      {/* Logo */}
      <div className="relative flex items-center gap-3 px-4 py-5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-glow">
          <Bot size={16} className="text-white" />
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="text-sm font-bold text-text">Kabayan AI</span>
              <span className="ml-1.5 badge badge-primary text-[10px]">v2</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-text-secondary hover:text-text hover:bg-card transition-all duration-150 shrink-0",
            !sidebarOpen && "rotate-180"
          )}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-2 shrink-0">
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "sidebar-item w-full",
            !sidebarOpen && "justify-center px-2"
          )}
        >
          <Search size={16} className="shrink-0" />
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
      </div>

      {/* New Chat Button */}
      <div className="px-3 mb-3 shrink-0">
        <button
          onClick={handleNewChat}
          className={cn(
            "btn-primary w-full justify-center text-xs",
            !sidebarOpen && "px-2"
          )}
        >
          <Plus size={14} />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Chat Baru
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('sidebar-item', isActive && 'active', !sidebarOpen && 'justify-center px-2')
            }
            title={!sidebarOpen ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
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
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div className="px-3 py-4 border-t border-border shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'active', !sidebarOpen && 'justify-center px-2')
          }
          title={!sidebarOpen ? 'Pengaturan' : undefined}
        >
          <Settings size={16} className="shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                Pengaturan
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
      </div>
    </motion.aside>
  );
}
