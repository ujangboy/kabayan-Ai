import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import UnifiedSidebar from '@/components/layout/UnifiedSidebar';
import TopBar from '@/components/layout/TopBar';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import CommandSearch from '@/components/search/CommandSearch';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import BackgroundProcessSync from '@/components/BackgroundProcessSync';
import FocusModeView from '@/components/FocusModeView';
import { useAppStore, useFocusStore } from '@/store';
import { useJobStore, cancelJobByKey } from '@/store/jobStore';
import { useTranslation } from 'react-i18next';

import { profileAPI, materiAPI, audioAPI } from '@/services/api';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';
import { extractErrorMessage } from '@/utils/errors';
import { useToast } from '@/components/Toast';

const OP_LABELS = [
  ['chat', 'appLayout.opChat'],
  ['notebook', 'appLayout.opNotebook'],
  ['process', 'appLayout.opProcess'],
  ['youtube', 'appLayout.opYoutube'],
  ['quiz', 'appLayout.opQuiz'],
  ['flashcard', 'appLayout.opFlashcard'],
  ['audio', 'appLayout.opAudio'],
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
  const jobs = useJobStore((s) => s.jobs);
  const { toast } = useToast();

  // Gabungkan job material (pendingOperations) + job background store.
  const materialOps = [...pendingOperations].map((op) => ({ key: op, label: getOpLabel(op, t), kind: 'material' }));
  const bgOps = Object.values(jobs).map((j) => ({ key: j.key, label: j.label || getOpLabel(j.type, t), kind: j.type, audioId: j.audioId }));
  const ops = [...materialOps, ...bgOps];

  if (ops.length === 0) return null;

  const handleCancel = async (op) => {
    try {
      if (op.kind === 'material') {
        const m = op.key.match(/^process-(\d+)$/);
        if (m) await materiAPI.cancel(Number(m[1]));
      } else if (op.kind === 'audio' && op.audioId) {
        await audioAPI.cancel(op.audioId);
      }
      cancelJobByKey(op.key);
      toast.info(t('appLayout.opCancelled'));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/25 text-warning text-xs flex-wrap"
        role="status"
        aria-live="polite"
      >
        <Icon name={ICONS.actions.refresh} size={12} className="animate-spin" />
        <span>
          {ops.length === 1
            ? t('appLayout.aiProcessing', { label: ops[0].label })
            : t('appLayout.aiProcessingMultiple', { count: ops.length })}
        </span>
        <span className="text-warning/70">·</span>
        <button
          onClick={() => handleCancel(ops[0])}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-warning/40 hover:bg-warning/20 transition-colors"
          aria-label={t('appLayout.opCancel')}
        >
          <Icon name={ICONS.actions.close} size={11} />
          {t('appLayout.opCancel')}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AppLayout() {
  const { searchOpen, setSidebarOpen, setLastRoute } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isFocusMode = useFocusStore((s) => s.isFocusMode);
  const focusActivity = useFocusStore((s) => s.focusActivity);
  const exitFocus = useFocusStore((s) => s.exitFocus);

  // Tutup drawer mobile (UnifiedSidebar) saat pindah halaman.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  // Catat halaman terakhir dikunjungi (persisted, tanpa auto-redirect).
  useEffect(() => {
    setLastRoute(location.pathname);
  }, [location.pathname, setLastRoute]);

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
        <UnifiedSidebar />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TopBar />
          {location.pathname !== '/notebook' && <Breadcrumbs />}
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
        <KeyboardShortcuts />
      </div>
    </MotionConfig>
  );
}