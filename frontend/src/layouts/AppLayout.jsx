import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import IconRail from '@/components/layout/IconRail';
import ContextSidebar from '@/components/layout/ContextSidebar';
import TopBar from '@/components/layout/TopBar';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import CommandSearch from '@/components/search/CommandSearch';
import BackgroundProcessSync from '@/components/BackgroundProcessSync';
import FocusModeView from '@/components/FocusModeView';
import { useAppStore, useFocusStore } from '@/store';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from '@/icons';
import { profileAPI } from '@/services/api';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';

const OP_LABELS = [
  ['chat', 'appLayout.opChat'],
  ['notebook', 'appLayout.opNotebook'],
  ['process', 'appLayout.opProcess'],
  ['youtube', 'appLayout.opYoutube'],
  ['quiz', 'appLayout.opQuiz'],
  ['flashcard', 'appLayout.opFlashcard'],
];

function getOpLabel(op, t) {
  if (typeof op !== 'string') op = String(op);
  for (const [prefix, key] of OP_LABELS) {
    if (op.startsWith(prefix)) return t(key);
  }
  return t('appLayout.opFallback');
}

function PendingBanner({ t }) {
  const pendingOperations = useAppStore((s) => s.pendingOperations);
  if (pendingOperations.size === 0) return null;

  const ops = [...pendingOperations];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/25 text-warning text-xs"
    >
      <RefreshCw size={12} className="animate-spin" />
      <span>
        {ops.length === 1 ? getOpLabel(ops[0], t) : t('appLayout.opRunningMultiple', { count: ops.length })}
      </span>
    </motion.div>
  );
}

export default function AppLayout() {
  const { searchOpen, setSidebarOpen } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isFocusMode = useFocusStore((s) => s.isFocusMode);
  const focusActivity = useFocusStore((s) => s.focusActivity);
  const exitFocus = useFocusStore((s) => s.exitFocus);

  // Hanya tampilkan context sidebar pada route yang membutuhkannya.
  // Chat & Notebook punya sidebar internal sendiri (hindari sidebar ganda).
  const hasContextSidebar = ['/materi', '/subjects', '/flashcard'].some((p) =>
    location.pathname.startsWith(p)
  );

  // Tutup drawer mobile saat pindah halaman (termasuk ke halaman tanpa sidebar).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  // Sinkronkan bahasa dari backend saat aplikasi pertama dibuka.
  useEffect(() => {
    let cancelled = false;
    profileAPI.get()
      .then((res) => {
        if (cancelled) return;
        const lang = res.data?.language;
        if (lang && !localStorage.getItem(STORAGE_KEY)) {
          setAppLanguage(lang);
        }
      })
      .catch(() => { /* abaikan — default 'id' */ });
    return () => { cancelled = true; };
  }, []);

  // Keluar otomatis dari mode fokus jika pengguna pindah halaman (mis. tombol back).
  useEffect(() => {
    if (isFocusMode && focusActivity && location.pathname !== focusActivity.to) {
      exitFocus();
    }
  }, [isFocusMode, focusActivity, location.pathname, exitFocus]);

  if (isFocusMode) {
    return (
      <MotionConfig reducedMotion="user">
        <FocusModeView
          activity={focusActivity}
          onExit={() => {
            exitFocus();
            navigate(focusActivity?.subjectId ? `/subjects/${focusActivity.subjectId}` : '/dashboard');
          }}
        >
          <Outlet />
        </FocusModeView>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen overflow-hidden bg-background">
        <BackgroundProcessSync />
        <IconRail />
        {hasContextSidebar && <ContextSidebar />}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TopBar />
          <Breadcrumbs />
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <PendingBanner t={t} />
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="flex-1 flex flex-col min-w-0 overflow-hidden"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <AnimatePresence>{searchOpen && <CommandSearch />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}
