import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, MessageSquare, BookMarked, CreditCard, HelpCircle, X } from '@/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store';

const QUICK_LINKS = [
  { icon: MessageSquare, labelKey: 'chatAI', to: '/chat', descKey: 'chatDesc' },
  { icon: FileText, labelKey: 'materi', to: '/materi', descKey: 'materiDesc' },
  { icon: BookMarked, labelKey: 'notebook', to: '/notebook', descKey: 'notebookDesc' },
  { icon: CreditCard, labelKey: 'flashcard', to: '/flashcard', descKey: 'flashcardDesc' },
  { icon: HelpCircle, labelKey: 'quiz', to: '/quiz', descKey: 'quizDesc' },
];

export default function CommandSearch() {
  const { t } = useTranslation();
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
    (l) => !query || t(`commandSearch.${l.labelKey}`).toLowerCase().includes(query.toLowerCase())
  );

  const go = (to) => { navigate(to); setSearchOpen(false); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-md"
        onClick={() => setSearchOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="glass-elevated w-full max-w-lg overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-purple-500/60 via-purple-500/20 to-transparent" />
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 divider-gradient-b relative">
            <Search size={16} className="text-text-secondary shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('commandSearch.searchPlaceholder')}
              className="flex-1 bg-transparent text-text text-sm placeholder:text-text-muted outline-none"
            />
            <button onClick={() => setSearchOpen(false)} className="text-text-muted hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Results */}
          <div className="py-2 max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">{t('commandSearch.noResults')}</p>
            ) : (
              <>
                <p className="px-4 py-1 text-xs text-text-muted font-medium uppercase tracking-wider">{t('commandSearch.quickNav')}</p>
                {filtered.map(({ icon: Icon, labelKey, to, descKey }) => (
                  <button
                    key={to}
                    onClick={() => go(to)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-gradient-primary">
                      <Icon size={15} className="text-primary transition-colors group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{t(`commandSearch.${labelKey}`)}</p>
                      <p className="text-xs text-text-muted">{t(`commandSearch.${descKey}`)}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-[11px] text-text-muted">
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> {t('commandSearch.navHint')}</span>
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">↵</kbd> {t('commandSearch.openHint')}</span>
            <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> {t('commandSearch.closeHint')}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
