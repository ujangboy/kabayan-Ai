import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandSearch from '@/components/search/CommandSearch';
import BackgroundProcessSync from '@/components/BackgroundProcessSync';
import { useAppStore } from '@/store';
import { profileAPI } from '@/services/api';
import { setAppLanguage, STORAGE_KEY } from '@/i18n';

const OP_LABELS = [
  ['chat', 'AI sedang berpikir…'],
  ['notebook', 'Menyimpan ke Notebook…'],
  ['audio', 'Membuat audio…'],
  ['process', 'Memproses materi…'],
  ['youtube', 'Memproses YouTube…'],
  ['quiz', 'Membuat quiz…'],
  ['flashcard', 'Membuat flashcard…'],
];

function getOpLabel(op) {
  if (typeof op !== 'string') op = String(op);
  for (const [prefix, label] of OP_LABELS) {
    if (op.startsWith(prefix)) return label;
  }
  return 'Memproses…';
}

function PendingBanner() {
  const pendingOperations = useAppStore((s) => s.pendingOperations);
  if (pendingOperations.size === 0) return null;

  const ops = [...pendingOperations];

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 text-xs">
      <span className="animate-spin inline-block">⏳</span>
      <span>
        {ops.length === 1 ? getOpLabel(ops[0]) : `${ops.length} proses berjalan…`}
      </span>
    </div>
  );
}

export default function AppLayout() {
  const { searchOpen } = useAppStore();

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <BackgroundProcessSync />
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <PendingBanner />
        <Outlet />
      </main>
      {searchOpen && <CommandSearch />}
    </div>
  );
}
