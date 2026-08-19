import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { subjectAPI, flashcardAPI } from '@/services/api';
import { useChatStore, useAppStore } from '@/store';
import { Plus, Folder, FileText, CreditCard, MessageSquare, Upload, BookMarked, Bot } from '@/icons';
import StorageMeter from './StorageMeter';

export default function ContextSidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const path = location.pathname;

  let content;
  if (path.startsWith('/materi')) content = <MateriSidebar />;
  else if (path.startsWith('/subjects')) content = <SubjectsSidebar />;
  else if (path.startsWith('/flashcard')) content = <FlashcardSidebar />;
  else if (path.startsWith('/chat')) content = <ChatSidebar />;
  else if (path.startsWith('/notebook')) content = <NotebookSidebar />;
  else content = <DefaultSidebar />;

  // Tutup drawer (mobile) saat pindah halaman.
  useEffect(() => { setSidebarOpen(false); }, [path, setSidebarOpen]);

  // Tutup drawer saat Esc ditekan.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <>
      {/* Desktop: sidebar statis */}
      <div className="hidden lg:block h-screen">{content}</div>

      {/* Mobile/tablet: drawer slide-over */}
      <AnimatePresence>
        {sidebarOpen && [
          <motion.div
            key="sidebar-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-y-0 left-14 right-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          />,
          <motion.div
            key="sidebar-drawer"
            initial={{ x: -264 }}
            animate={{ x: 0 }}
            exit={{ x: -264 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-y-0 left-14 z-40 w-60 lg:hidden"
          >
            {content}
          </motion.div>,
        ]}
      </AnimatePresence>
    </>
  );
}

function DefaultSidebar() {
  const { t } = useTranslation();
  return (
    <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center mb-3">
          <Bot size={22} className="text-text-muted" />
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{t('sidebar.contextHint')}</p>
      </div>
      <StorageMeter />
    </aside>
  );
}

function SidebarHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 shrink-0">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary-light" />
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MateriSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
  });
  const subjects = data?.subjects || [];

  return (
      <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <SidebarHeader
        icon={FileText}
        title={t('nav.materi')}
        action={
          <button
            onClick={() => navigate('/materi?upload=1')}
              className="p-1.5 rounded-xl text-primary-light hover:bg-card transition-colors"
            title={t('materi.upload')}
          >
            <Upload size={16} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {subjects.length === 0 ? (
          <p className="text-xs text-text-muted px-1 py-2">{t('subjects.empty')}</p>
        ) : (
          subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/materi?subject_id=${s.id}`)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
            >
              <Folder size={15}               className="text-warning shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
          ))
        )}
      </div>
      <StorageMeter />
    </aside>
  );
}

function SubjectsSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
  });
  const subjects = data?.subjects || [];

  return (
      <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <SidebarHeader
        icon={Folder}
        title={t('nav.subjects')}
        action={
          <button
            onClick={() => navigate('/subjects?new=1')}
              className="p-1.5 rounded-xl text-primary-light hover:bg-card transition-colors"
            title={t('subjects.new')}
          >
            <Plus size={16} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/subjects/${s.id}`)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
          >
            <Folder size={15}               className="text-warning shrink-0" />
            <span className="truncate">{s.name}</span>
          </button>
        ))}
      </div>
      <StorageMeter />
    </aside>
  );
}

function FlashcardSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['flashcard-all'],
    queryFn: () => flashcardAPI.getAll().then((r) => r.data),
  });
  const decks = data?.decks || [];

  return (
      <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <SidebarHeader icon={CreditCard} title={t('nav.flashcard')} />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => navigate(`/flashcard?deck_id=${d.id}`)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
          >
            <CreditCard size={15} className="text-primary-light shrink-0" />
            <span className="truncate">{d.name}</span>
          </button>
        ))}
      </div>
      <StorageMeter />
    </aside>
  );
}

function ChatSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chats = useChatStore((s) => s.chats);

  return (
      <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <SidebarHeader icon={MessageSquare} title={t('nav.chat')} />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {chats.length === 0 ? (
          <p className="text-xs text-text-muted px-1 py-2">{t('chat.empty')}</p>
        ) : (
          chats.slice(0, 30).map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chat?id=${c.id}`)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
            >
              <MessageSquare size={15} className="text-primary-light shrink-0" />
              <span className="truncate">{c.title || t('chat.untitled')}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function NotebookSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notes'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
  });
  const notes = data?.notes || [];

  return (
      <aside className="flex h-full flex-col w-60 bg-surface divider-gradient-r relative shrink-0">
      <SidebarHeader icon={BookMarked} title={t('nav.notebook')} />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {notes.slice(0, 30).map((n) => (
          <button
            key={n.id}
            onClick={() => navigate(`/notebook?note_id=${n.id}`)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-card hover:text-text transition-colors text-sm"
          >
            <BookMarked size={15} className="text-primary-light shrink-0" />
            <span className="truncate">{n.title || t('notebook.untitled')}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
