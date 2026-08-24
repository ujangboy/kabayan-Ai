import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore, useChatStore } from '@/store';
import { cn } from '@/utils';

export default function CommandSearch() {
  const { t } = useTranslation();
  const { setSearchOpen } = useAppStore();
  const createChat = useChatStore((s) => s.createChat);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSearchOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  // Grup: navigasi halaman + aksi cepat. Aksi tetap tampil saat pencarian kosong.
  const sections = useMemo(() => [
    {
      id: 'nav',
      labelKey: 'commandSearch.quickNav',
      items: [
        { id: 'chat', icon: ICONS.communication.chat, label: t('commandSearch.chatAI'), desc: t('commandSearch.chatDesc'), action: () => { const id = createChat(); navigate(`/chat?id=${id}`); } },
        { id: 'materi', icon: ICONS.files.document, label: t('commandSearch.materi'), desc: t('commandSearch.materiDesc'), action: () => navigate('/materi') },
        { id: 'notebook', icon: ICONS.learning.bookmarks, label: t('commandSearch.notebook'), desc: t('commandSearch.notebookDesc'), action: () => navigate('/notebook') },
        { id: 'flashcard', icon: ICONS.nav.flashcard, label: t('commandSearch.flashcard'), desc: t('commandSearch.flashcardDesc'), action: () => navigate('/flashcard') },
        { id: 'quiz', icon: ICONS.ui.help, label: t('commandSearch.quiz'), desc: t('commandSearch.quizDesc'), action: () => navigate('/quiz') },
      ],
    },
    {
      id: 'actions',
      labelKey: 'commandSearch.actions',
      items: [
        { id: 'new-chat', icon: ICONS.communication.chat, label: t('commandSearch.actionNewChat'), desc: t('commandSearch.actionNewChatDesc'), action: () => { const id = createChat(); navigate(`/chat?id=${id}`); } },
        { id: 'study-plan', icon: ICONS.learning.calendarCheck, label: t('nav.studyPlan'), desc: t('commandSearch.actionStudyPlanDesc'), action: () => navigate('/study-plan') },
        { id: 'settings', icon: ICONS.nav.settings, label: t('nav.settings'), desc: t('commandSearch.actionSettingsDesc'), action: () => navigate('/settings') },
      ],
    },
  ], [t, createChat, navigate]);

  // Flatten + filter (match label/desc, ikut bahasa aktif).
  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    sections.forEach((sec) => {
      const matched = q
        ? sec.items.filter((it) => (it.label + ' ' + it.desc).toLowerCase().includes(q))
        : sec.items;
      if (matched.length > 0) out.push({ section: sec, items: matched });
    });
    return out;
  }, [sections, query]);

  const total = flat.reduce((acc, g) => acc + g.items.length, 0);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Navigasi keyboard — index global (flatten antar grup).
  const onKeyDown = (e) => {
    if (total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat.flatMap((g) => g.items)[activeIndex];
      if (item) { item.action(); setSearchOpen(false); }
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  // Scroll item aktif ke viewport saat index berubah.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const go = (item) => { item.action(); setSearchOpen(false); };

  let globalIdx = 0;

  return (
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
          <Icon name={ICONS.actions.search} size={16} className="text-text-secondary shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('commandSearch.searchPlaceholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-search-list"
            aria-activedescendant={activeIndex >= 0 ? `cmd-item-${activeIndex}` : undefined}
            className="flex-1 bg-transparent text-text text-sm placeholder:text-text-muted outline-none"
          />
          <button onClick={() => setSearchOpen(false)} className="text-text-muted hover:text-text transition-colors">
            <Icon name={ICONS.actions.close} size={14} />
          </button>
        </div>

        {/* Results */}
        <div id="command-search-list" ref={listRef} role="listbox" className="py-2 max-h-72 overflow-y-auto">
          {total === 0 ? (
            <p className="text-center text-text-muted text-sm py-8">{t('commandSearch.noResults')}</p>
          ) : (
            flat.map(({ section, items }) => (
              <div key={section.id}>
                <p className="px-4 py-1 text-xs text-text-muted font-medium uppercase tracking-wider">
                  {t(section.labelKey)}
                </p>
                {items.map((item) => {
                  const index = globalIdx++;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-item-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left group transition-colors',
                        isActive ? 'bg-background' : 'hover:bg-background'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        isActive ? 'bg-gradient-primary' : 'bg-primary/10 group-hover:bg-gradient-primary'
                      )}>
                        <item.icon size={15} className={isActive ? 'text-white' : 'text-primary transition-colors group-hover:text-white'} />
                      </div>
                      <div>
                        <p className="text-base font-medium text-text">{item.label}</p>
                        <p className="text-xs text-text-muted">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-2xs text-text-muted">
          <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-3xs">↑↓</kbd> {t('commandSearch.navHint')}</span>
          <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-3xs">↵</kbd> {t('commandSearch.openHint')}</span>
          <span><kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-3xs">Esc</kbd> {t('commandSearch.closeHint')}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}