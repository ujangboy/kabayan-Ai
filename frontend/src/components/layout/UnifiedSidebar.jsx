import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon, Tooltip } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';
import { useAppStore } from '@/store';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { KabayanMark } from '@/components/brand/KabayanLogo';

const EXPANDED_WIDTH = 264;
const RAIL_WIDTH = 76;
const DESKTOP_QUERY = '(min-width: 1024px)';
const MOBILE_QUERY = '(max-width: 767px)';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener?.('change', onChange);
    setMatches(mq.matches);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Navigasi utama sengaja datar: tiga kelompok yang mencerminkan ritme harian
 * (hari ini → belajar → koleksi). Submenu per mata kuliah/deck dulu membuat
 * sidebar menjadi pohon panjang dan menduplikasi filter yang sudah ada di
 * halaman masing-masing; sekarang konteks dikelola di halaman.
 */
const NAV_GROUPS = [
  {
    id: 'today',
    labelKey: 'nav.groupToday',
    fallback: 'Hari ini',
    items: [
      { to: '/dashboard', icon: ICONS.nav.dashboard, labelKey: 'nav.dashboard' },
      { to: '/chat', icon: ICONS.nav.chat, labelKey: 'nav.chat' },
      { to: '/study-plan', icon: ICONS.nav.studyPlan, labelKey: 'nav.studyPlan' },
    ],
  },
  {
    id: 'learn',
    labelKey: 'nav.groupLearn',
    fallback: 'Belajar',
    items: [
      { to: '/materi', icon: ICONS.nav.materials, labelKey: 'nav.materi' },
      { to: '/notebook', icon: ICONS.nav.notebook, labelKey: 'nav.notebook' },
      { to: '/flashcard', icon: ICONS.nav.flashcard, labelKey: 'nav.flashcard' },
      { to: '/quiz', icon: ICONS.nav.quiz, labelKey: 'nav.quiz' },
      { to: '/exam-analyzer', icon: ICONS.nav.exam, labelKey: 'nav.exam' },
    ],
  },
  {
    id: 'library',
    labelKey: 'nav.groupLibrary',
    fallback: 'Koleksi',
    items: [
      { to: '/subjects', icon: ICONS.nav.subjects, labelKey: 'nav.subjects' },
      { to: '/audio', icon: ICONS.nav.audio, labelKey: 'nav.audio' },
    ],
  },
];

function isPathActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function SidebarContent({ collapsed, onNavigate, hideToggle = false }) {
  const { t } = useTranslation();
  const location = useLocation();
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);
  const settingsActive = isPathActive(location.pathname, '/settings');

  const navItem = (item) => {
    const active = isPathActive(location.pathname, item.to);
    const row = (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => onNavigate?.()}
        aria-current={active ? 'page' : undefined}
        aria-label={t(item.labelKey)}
        className={cn(
          'group relative flex h-10 items-center rounded-xl transition-colors duration-200',
          collapsed ? 'w-10 justify-center' : 'gap-3 px-3',
          active
            ? 'bg-primary/10 text-primary-light'
            : 'text-text-secondary hover:bg-wash hover:text-text'
        )}
      >
        {/* Penanda aktif statis (bukan layoutId): sebelumnya indikator "terbang"
            lintas kelompok menu sehingga terasa melompat ke bawah. */}
        {active && (
          <span aria-hidden className="absolute -left-px top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
        )}
        <Icon
          name={item.icon}
          size={19}
          className={cn('shrink-0 transition-transform duration-200', !active && 'group-hover:scale-[1.04]')}
        />
        {!collapsed && <span className="truncate text-meta font-medium">{t(item.labelKey)}</span>}
      </NavLink>
    );

    return collapsed ? (
      <Tooltip key={item.to} label={t(item.labelKey)} side="right">
        {row}
      </Tooltip>
    ) : (
      row
    );
  };

  return (
    <div className="flex h-full flex-col bg-sidebar divider-gradient-r">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border/70',
          collapsed ? 'justify-between px-2' : 'justify-between px-4'
        )}
      >
        {collapsed ? (
          <NavLink to="/dashboard" onClick={() => onNavigate?.()} aria-label="Kabayan Pintar">
            <KabayanMark size={30} />
          </NavLink>
        ) : (
          <NavLink to="/dashboard" onClick={() => onNavigate?.()} className="min-w-0">
            <span className="flex items-center gap-2.5">
              <KabayanMark size={34} />
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-extrabold tracking-[-0.045em] text-text">
                  kabayan
                </span>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-display text-3xs font-extrabold uppercase tracking-[0.12em] text-primary-light">
                  Pintar
                </span>
              </span>
            </span>
          </NavLink>
        )}
        {/* Toggle buka/tutup selalu di posisi yang sama (kanan header), di semua
            keadaan — sebelumnya pindah ke footer saat rail, dan hilang di drawer. */}
        {!hideToggle && (
          <Tooltip label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')} side="right">
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
              className={cn(
                'flex items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-wash hover:text-text',
                collapsed ? 'h-7 w-7' : 'h-9 w-9'
              )}
            >
              <Icon
                name={collapsed ? ICONS.actions.panelLeft : ICONS.actions.panelLeftClose}
                size={collapsed ? 16 : 18}
              />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.id} className={cn(groupIdx > 0 && (!collapsed ? 'mt-4' : 'mt-3'))}>
            {collapsed ? (
              groupIdx > 0 && <div className="mx-2 mb-2 h-px bg-border/80" />
            ) : (
              <p className="px-3 pb-1.5 pt-3 font-display text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">
                {t(group.labelKey, group.fallback)}
              </p>
            )}
            <div className="space-y-0.5">{group.items.map(navItem)}</div>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col border-t border-border/80 bg-sidebar px-3 py-2">
        <NavLink
          to="/settings"
          onClick={() => onNavigate?.()}
          aria-current={settingsActive ? 'page' : undefined}
          aria-label={t('nav.settings')}
          className={cn(
            'relative flex h-10 items-center rounded-xl transition-colors',
            collapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3',
            settingsActive
              ? 'bg-primary/10 text-primary-light'
              : 'text-text-secondary hover:bg-wash hover:text-text'
          )}
        >
          {/* Penanda aktif statis yang sama dengan item nav utama */}
          {settingsActive && (
            <span aria-hidden className="absolute -left-px top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
          )}
          <Icon name={ICONS.nav.settings} size={19} className="shrink-0" />
          {!collapsed && <span className="text-meta font-medium">{t('nav.settings')}</span>}
        </NavLink>
      </div>
    </div>
  );
}

export default function UnifiedSidebar() {
  const collapsed = useAppStore((s) => s.collapsed);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const showRailInFlow = !isDesktop && !isMobile;

  useSwipeGesture({
    window: true,
    onSwipeRight: () => { if (!isDesktop) setSidebarOpen(true); },
    enabled: !isDesktop,
  });
  const { ref: drawerRef } = useSwipeGesture({
    onSwipeLeft: () => setSidebarOpen(false),
    enabled: sidebarOpen && !isDesktop,
  });

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, isDesktop, setSidebarOpen]);

  if (isDesktop) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? RAIL_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 h-screen shrink-0"
      >
        <SidebarContent collapsed={collapsed} />
      </motion.aside>
    );
  }

  return (
    <>
      {showRailInFlow && (
        <aside className="relative z-20 h-screen w-[76px] shrink-0">
          <SidebarContent collapsed hideToggle />
        </aside>
      )}

      <AnimatePresence>
        {sidebarOpen && [
          <motion.div
            key="sidebar-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            /* Task 7b: scrim & drawer di atas MiniAudioPlayer (z-50) supaya
               kartu mini tidak melayang menembus dim layer; tetap di bawah
               modal tertinggi (FocusMode z-100, Toast z-9998/9999). */
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />,
          <motion.aside
            key="sidebar-drawer"
            ref={drawerRef}
            initial={{ x: -EXPANDED_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -EXPANDED_WIDTH }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-[70] w-[264px] touch-pan-y"
          >
            <SidebarContent collapsed={false} onNavigate={() => setSidebarOpen(false)} hideToggle />
          </motion.aside>,
        ]}
      </AnimatePresence>
    </>
  );
}
