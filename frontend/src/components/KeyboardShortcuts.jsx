import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui';
import { useAppStore, useChatStore } from '@/store';

const QUICK_NAV = {
  1: '/dashboard',
  2: '/chat',
  3: '/subjects',
  4: '/materi',
  5: '/notebook',
  6: '/flashcard',
  7: '/quiz',
  8: '/exam-analyzer',
  9: '/study-plan',
};

/**
 * KeyboardShortcuts — overlay pintasan keyboard (PRD-01 §5.3).
 *
 * Menyediakan:
 *   - Modal daftar pintasan (Radix Dialog, grup Navigasi/Aksi/Khusus Halaman).
 *   - Listener global: `?` buka/tutup modal, ⌘K/⌘/ buka command search,
 *     ⌘N chat baru, `G` lalu `D`/`C` navigasi cepat, `1-9` quick nav.
 *
 * Semua shortcut dinonaktifkan saat user sedang mengetik di input/textarea
 * (kecuali kombinasi ⌘/Ctrl yang tetap berfungsi).
 */
export default function KeyboardShortcuts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createChat = useChatStore((s) => s.createChat);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const gKeyRef = useRef(false);

  useEffect(() => {
    const isTyping = (e) => {
      const el = e.target;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };

    const onKeyDown = (e) => {
      const combo = e.metaKey || e.ctrlKey;

      // `?` — buka/tutup modal pintasan (di luar field teks).
      if (e.key === '?' && !combo && !e.altKey && !isTyping(e)) {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
        return;
      }

      // Kombinasi ⌘/Ctrl — selalu aktif, termasuk saat mengetik.
      if (combo) {
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setSearchOpen(true);
          return;
        }
        if (e.key === '/') {
          e.preventDefault();
          setSearchOpen(true);
          return;
        }
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          const id = createChat();
          navigate(`/chat?id=${id}`);
          return;
        }
      }

      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;

      // `G` lalu `D`/`C` — navigasi berurutan dua tombol.
      if (e.key === 'g' || e.key === 'G') {
        gKeyRef.current = true;
        return;
      }
      if (gKeyRef.current) {
        gKeyRef.current = false;
        if (e.key === 'd' || e.key === 'D') {
          navigate('/dashboard');
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          navigate('/chat');
          return;
        }
        return;
      }

      // `1-9` — quick nav halaman utama.
      const num = Number(e.key);
      if (!Number.isNaN(num) && num >= 1 && num <= 9) {
        const route = QUICK_NAV[num];
        if (route) navigate(route);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, createChat, setSearchOpen, shortcutsOpen, setShortcutsOpen]);

  const groups = [
    {
      title: t('shortcuts.groups.navigation'),
      items: [
        { keys: ['?'], label: t('shortcuts.showShortcuts') },
        { keys: ['G', 'D'], label: t('shortcuts.goDashboard') },
        { keys: ['G', 'C'], label: t('shortcuts.goChat') },
        { keys: ['1', '9'], label: t('shortcuts.quickNav') },
      ],
    },
    {
      title: t('shortcuts.groups.actions'),
      items: [
        { keys: ['⌘K', 'Ctrl+K'], label: t('shortcuts.commandSearch') },
        { keys: ['⌘N', 'Ctrl+N'], label: t('shortcuts.newChat') },
        { keys: ['⌘/', 'Ctrl+/'], label: t('shortcuts.focusSearch') },
        { keys: ['Esc'], label: t('shortcuts.closeModal') },
      ],
    },
  ];

  return (
    <Modal
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      size="lg"
      title={t('shortcuts.title')}
      description={t('shortcuts.subtitle')}
    >
      <div className="grid gap-6 p-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              {group.title}
            </p>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
                >
                  <span className="text-sm text-text-secondary">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((key, i) => (
                      <span key={key + i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-text-muted">+</span>}
                        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-text">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}