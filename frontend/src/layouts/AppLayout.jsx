import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandSearch from '@/components/search/CommandSearch';
import BackgroundProcessSync from '@/components/BackgroundProcessSync';
import FocusModeView from '@/components/FocusModeView';
import { useAppStore, useFocusStore } from '@/store';
import { useTranslation } from 'react-i18next';
import { profileAPI } from '@/services/api';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';

const OP_LABELS = [
  ['chat', 'appLayout.opChat'],
  ['notebook', 'appLayout.opNotebook'],
  ['audio', 'appLayout.opAudio'],
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
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 text-xs">
      <span className="animate-spin inline-block">⏳</span>
      <span>
        {ops.length === 1 ? getOpLabel(ops[0], t) : t('appLayout.opRunningMultiple', { count: ops.length })}
      </span>
    </div>
  );
}

export default function AppLayout() {
  const { searchOpen } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isFocusMode = useFocusStore((s) => s.isFocusMode);
  const focusActivity = useFocusStore((s) => s.focusActivity);
  const exitFocus = useFocusStore((s) => s.exitFocus);

  // Sinkronkan bahasa dari backend saat aplikasi pertama dibuka.
  // localStorage adalah sumber instant untuk i18n; backend adalah sumber persisten.
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
      <FocusModeView
        activity={focusActivity}
        onExit={() => {
          exitFocus();
          navigate(focusActivity?.subjectId ? `/subjects/${focusActivity.subjectId}` : '/dashboard');
        }}
      >
        <Outlet />
      </FocusModeView>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <BackgroundProcessSync />
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <PendingBanner t={t} />
        <Outlet />
      </main>
      {searchOpen && <CommandSearch />}
    </div>
  );
}
