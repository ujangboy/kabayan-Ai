import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, MessageSquare, BookMarked, CreditCard, HelpCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';

const QUICK_LINKS = [
  { icon: MessageSquare, label: 'Chat AI', to: '/chat', desc: 'Mulai percakapan baru' },
  { icon: FileText, label: 'Materi', to: '/materi', desc: 'Kelola materi kuliah' },
  { icon: BookMarked, label: 'Notebook', to: '/notebook', desc: 'Catatan dan ringkasan' },
  { icon: CreditCard, label: 'Flashcard', to: '/flashcard', desc: 'Kartu hafalan' },
  { icon: HelpCircle, label: 'Quiz', to: '/quiz', desc: 'Latihan soal' },
];

export default function CommandSearch() {
  const { setSearchOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSearchOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  const filtered = QUICK_LINKS.filter(
    (l) => !query || l.label.toLowerCase().includes(query.toLowerCase())
  );

  const go = (to) => { navigate(to); setSearchOpen(false); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={() => setSearchOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-card border border-border rounded-dialog shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={16} className="text-text-secondary shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari halaman, materi, catatan..."
              className="flex-1 bg-transparent text-text text-sm placeholder:text-text-muted outline-none"
            />
            <button onClick={() => setSearchOpen(false)} className="text-text-muted hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Results */}
          <div className="py-2 max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">Tidak ada hasil ditemukan</p>
            ) : (
              <>
                <p className="px-4 py-1 text-xs text-text-muted font-medium uppercase tracking-wider">Navigasi Cepat</p>
                {filtered.map(({ icon: Icon, label, to, desc }) => (
                  <button
                    key={to}
                    onClick={() => go(to)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{label}</p>
                      <p className="text-xs text-text-muted">{desc}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-[11px] text-text-muted">
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigasi</span>
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">↵</kbd> buka</span>
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> tutup</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
