import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { subjectAPI, flashcardAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { Icon } from '@/components/ui/Icon';
import { ICONS } from '@/lib/icons';
import StorageMeter from './StorageMeter';

export default function ContextSidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const path = location.pathname;

  let content;
  if (path.startsWith('/materi')) content = <MateriSidebar />;
  else if (path.startsWith('/subjects')) content = <SubjectsSidebar />;
  else content = <FlashcardSidebar />;

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
            className="fixed inset-y-0 left-14 right-0 z-30 bg-black/60 backdrop-blur-md lg:hidden"
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

function SidebarHeader({ icon, title, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 shrink-0">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={16} className="text-primary-light" />
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
    <aside className="flex h-full flex-col w-60 bg-surface/80 backdrop-blur-md divider-gradient-r relative shrink-0">
      <SidebarHeader
        icon={ICONS.files.document}
        title={t('nav.materi')}
        action={
          <button
            onClick={() => navigate('/materi?upload=1')}
            className="p-1.5 rounded-xl text-primary-light hover:bg-white/[0.06] transition-colors"
            title={t('materi.upload')}
          >
            <Icon name={ICONS.actions.upload} size={16} />
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
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-white/[0.06] hover:text-text transition-colors text-sm"
            >
              <Icon name={ICONS.files.folder} size={15} className="text-warning shrink-0" />
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
    <aside className="flex h-full flex-col w-60 bg-surface/80 backdrop-blur-md divider-gradient-r relative shrink-0">
      <SidebarHeader
        icon={ICONS.files.folder}
        title={t('nav.subjects')}
        action={
          <button
            onClick={() => navigate('/subjects?new=1')}
            className="p-1.5 rounded-xl text-primary-light hover:bg-white/[0.06] transition-colors"
            title={t('subjects.new')}
          >
            <Icon name={ICONS.actions.addOutline} size={16} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/subjects/${s.id}`)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-white/[0.06] hover:text-text transition-colors text-sm"
          >
            <Icon name={ICONS.files.folder} size={15} className="text-warning shrink-0" />
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
  // Backend mengembalikan { flashcards }, bukan { decks } — kelompokkan per batch_id
  const all = data?.flashcards || [];
  const map = {};
  for (const f of all) {
    const bid = String(f.batch_id || `legacy-${f.subject?.id ?? 0}`);
    if (!map[bid]) map[bid] = { batch_id: bid, subject: f.subject || { id: 0, name: t('flashcard.defaultName') }, cards: [] };
    map[bid].cards.push(f);
  }
  const decks = Object.values(map).sort((a, b) => {
    const aTime = new Date(a.cards[0]?.created_at || 0);
    const bTime = new Date(b.cards[0]?.created_at || 0);
    return bTime - aTime;
  });

  return (
    <aside className="flex h-full flex-col w-60 bg-surface/80 backdrop-blur-md divider-gradient-r relative shrink-0">
      <SidebarHeader icon={ICONS.nav.flashcard} title={t('nav.flashcard')} />
      <div className="flex-1 overflow-y-auto sidebar-scroll px-3 space-y-1">
        {decks.map((d) => (
          <button
            key={d.batch_id}
            onClick={() => navigate(`/flashcard?deck_id=${d.batch_id}`)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-white/[0.06] hover:text-text transition-colors text-sm"
          >
            <Icon name={ICONS.nav.flashcard} size={15} className="text-primary-light shrink-0" />
            <span className="truncate">{d.subject?.name || t('flashcard.defaultName')}</span>
          </button>
        ))}
      </div>
      <StorageMeter />
    </aside>
  );
}