import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon, Tooltip } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';
import { useAppStore } from '@/store';
import { subjectAPI, flashcardAPI, sessionsAPI } from '@/services/api';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import StorageMeter from './StorageMeter';

const EXPANDED_WIDTH = 240;
const RAIL_WIDTH = 68;
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

const NAV = [
  { to: '/dashboard', icon: ICONS.nav.dashboard, labelKey: 'nav.dashboard' },
  { to: '/chat', icon: ICONS.nav.chat, labelKey: 'nav.chat' },
  { to: '/subjects', icon: ICONS.nav.subjects, labelKey: 'nav.subjects', group: 'subjects' },
  { to: '/materi', icon: ICONS.nav.materials, labelKey: 'nav.materi', group: 'materi' },
  { to: '/notebook', icon: ICONS.nav.notebook, labelKey: 'nav.notebook' },
  { to: '/flashcard', icon: ICONS.nav.flashcard, labelKey: 'nav.flashcard', group: 'flashcard' },
  { to: '/quiz', icon: ICONS.nav.quiz, labelKey: 'nav.quiz' },
  { to: '/exam-analyzer', icon: ICONS.nav.exam, labelKey: 'nav.exam' },
  { to: '/study-plan', icon: ICONS.nav.studyPlan, labelKey: 'nav.studyPlan', group: 'studyPlan' },
];

function isActive(to, pathname) {
  if (to === '/exam-analyzer') return pathname === '/exam-analyzer';
  return pathname === to || pathname.startsWith(to + '/');
}

/* ── Konten sidebar (dipakai di mode rail, expanded, dan drawer) ───────────── */
function SidebarContent({ collapsed, onNavigate }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);

  // Auto-expand grup yang sedang aktif.
  const [openGroups, setOpenGroups] = useState(() => new Set());
  useEffect(() => {
    const active = NAV.filter((n) => n.group && isActive(n.to, location.pathname)).map((n) => n.group);
    if (active.length === 0) return;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      active.forEach((g) => next.add(g));
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (g) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
    enabled: !collapsed,
  });
  const { data: flashcards } = useQuery({
    queryKey: ['flashcard-all'],
    queryFn: () => flashcardAPI.getAll().then((r) => r.data),
    enabled: !collapsed,
  });
  const { data: sessions } = useQuery({
    queryKey: ['sidebar-study-plans'],
    queryFn: () => sessionsAPI.list().then((r) => r.data),
    enabled: !collapsed,
  });

  const subjectList = subjects?.subjects || [];

  // Kelompokkan flashcard per batch_id (sama seperti ContextSidebar lama).
  const decks = (() => {
    const all = flashcards?.flashcards || [];
    const map = {};
    for (const f of all) {
      const bid = String(f.batch_id || `legacy-${f.subject?.id ?? 0}`);
      if (!map[bid]) {
        map[bid] = { batch_id: bid, subject: f.subject || { id: 0, name: t('flashcard.defaultName') }, cards: [] };
      }
      map[bid].cards.push(f);
    }
    return Object.values(map).sort((a, b) => {
      const aTime = new Date(a.cards[0]?.created_at || 0);
      const bTime = new Date(b.cards[0]?.created_at || 0);
      return bTime - aTime;
    });
  })();

  const submenuItems = (group) => {
    if (group === 'subjects') {
      return subjectList.map((s) => ({ key: `s-${s.id}`, label: s.name, to: `/subjects/${s.id}`, icon: ICONS.files.folder, active: location.pathname === `/subjects/${s.id}` }));
    }
    if (group === 'materi') {
      return subjectList.map((s) => ({ key: `m-${s.id}`, label: s.name, to: `/materi?subject_id=${s.id}`, icon: ICONS.files.folder, active: new URLSearchParams(location.search).get('subject_id') === String(s.id) }));
    }
    if (group === 'flashcard') {
      return decks.map((d) => ({ key: `f-${d.batch_id}`, label: d.subject?.name || t('flashcard.defaultName'), to: `/flashcard?deck_id=${d.batch_id}`, icon: ICONS.nav.flashcard, active: new URLSearchParams(location.search).get('deck_id') === d.batch_id }));
    }
    if (group === 'studyPlan') {
      const list = sessions?.sessions || [];
      const plans = list.filter((s) => s.has_study_plan);
      const shown = plans.length ? plans : list;
      return shown.map((s) => ({
        key: `sp-${s.id}`,
        label: s.subject_name || t('studyplan.noSessionTitle', 'Rencana Belajar'),
        to: `/study-plan?session_id=${s.id}`,
        icon: ICONS.nav.studyPlan,
        active: new URLSearchParams(location.search).get('session_id') === String(s.id),
      }));
    }
    return [];
  };

  const handleNav = (to) => {
    navigate(to);
    onNavigate?.();
  };

  const renderTopItem = (item) => {
    const active = isActive(item.to, location.pathname);
    const hasGroup = !!item.group;
    const groupOpen = openGroups.has(item.group);

    const row = (
      <div className="relative flex items-center">
        {active && (
          <motion.span
            layoutId="nav-active-indicator"
            className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-gradient-primary"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          />
        )}
        <NavLink
          to={item.to}
          onClick={() => onNavigate?.()}
          aria-label={t(item.labelKey)}
          className={cn(
            'group relative flex h-10 items-center rounded-xl transition-all duration-200',
            collapsed ? 'w-10 justify-center' : 'flex-1 gap-3 pl-3 pr-2',
            active ? 'bg-primary/15 text-primary-light' : 'text-text-secondary hover:bg-card hover:text-text'
          )}
        >
          <Icon name={item.icon} size={20} className="shrink-0" />
          {!collapsed && <span className="truncate text-sm font-medium">{t(item.labelKey)}</span>}
        </NavLink>
        {!collapsed && hasGroup && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGroup(item.group); }}
            aria-label={groupOpen ? t('sidebar.collapse') : t('sidebar.expand')}
            className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <motion.span animate={{ rotate: groupOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <Icon name={ICONS.actions.expand} size={16} />
            </motion.span>
          </button>
        )}
      </div>
    );

    const wrapped = collapsed ? (
      <Tooltip label={t(item.labelKey)} side="right">
        <div>{row}</div>
      </Tooltip>
    ) : row;

    return (
      <div key={item.to}>
        {wrapped}
        {!collapsed && hasGroup && (
          <AnimatePresence initial={false}>
            {groupOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mb-1 ml-[26px] mt-1 border-l border-border pl-2">
                  <div className="sidebar-scroll space-y-0.5 max-h-[28vh] overflow-y-auto pr-1 overscroll-contain md:max-h-[260px]">
                    {submenuItems(item.group).map((sub) => (
                      <button
                        key={sub.key}
                        onClick={() => handleNav(sub.to)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                          sub.active ? 'bg-primary/10 text-primary-light' : 'text-text-secondary hover:bg-card hover:text-text'
                        )}
                      >
                        <Icon name={sub.icon} size={15} className={cn('shrink-0', sub.active ? 'text-primary-light' : 'text-warning')} />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    ))}
                    {submenuItems(item.group).length === 0 && (
                      <p className="px-2.5 py-1 text-xs text-text-muted">{t('subjects.empty')}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-sidebar/80 backdrop-blur-[16px] divider-gradient-r">
      {/* Logo + toggle (expanded: kanan; collapsed/rail: logo di tengah, toggle di footer) */}
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-0' : 'justify-between px-4')}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-btn-primary">
            <span className="absolute inset-0 rounded-xl bg-gradient-primary opacity-50 blur-md" />
            <Icon name={ICONS.communication.bot} size={20} className="relative text-white" />
          </div>
          {!collapsed && <span className="text-sm font-semibold text-text">Kabayan AI</span>}
        </div>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label={t('sidebar.collapse')}
            title={t('sidebar.collapse')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <Icon name={ICONS.actions.menu} size={18} />
          </button>
        )}
      </div>

      {/* Search trigger */}
      <div className={cn('px-3', collapsed ? 'flex justify-center' : '')}>
        <Tooltip label={t('common.search')} side={collapsed ? 'right' : 'top'}>
          <button
            onClick={() => { useAppStore.getState().setSearchOpen(true); onNavigate?.(); }}
            aria-label={t('common.search')}
            className="flex h-10 w-full items-center gap-2 rounded-xl px-2.5 text-text-secondary transition-colors hover:bg-card hover:text-text"
          >
            <Icon name={ICONS.actions.search} size={20} className="shrink-0" />
            {!collapsed && <span className="text-sm">{t('common.search')}</span>}
          </button>
        </Tooltip>
      </div>

      <div className="my-2 h-px bg-border" />

      {/* Nav utama */}
      <nav className="sidebar-scroll flex-1 min-h-0 space-y-1 overflow-y-auto px-3">
        {NAV.map(renderTopItem)}
      </nav>

      <div className="my-2 h-px bg-border" />

      {/* Settings */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <Tooltip label={t('nav.settings')} side="right">
            <NavLink to="/settings" onClick={() => onNavigate?.()} aria-label={t('nav.settings')} className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-card hover:text-text">
              <Icon name={ICONS.nav.settings} size={20} />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink to="/settings" onClick={() => onNavigate?.()} className={cn('flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', location.pathname.startsWith('/settings') ? 'bg-primary/15 text-primary-light' : 'text-text-secondary hover:bg-card hover:text-text')}>
            <Icon name={ICONS.nav.settings} size={20} className="shrink-0" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        )}
      </div>

      {/* Storage meter (expanded only) */}
      {!collapsed && <StorageMeter />}

      {/* Toggle expand (collapsed/rail only — tidak overlap karena storage meter tersembunyi) */}
      {collapsed && (
        <div className="flex justify-center px-3 pb-3">
          <Tooltip label={t('sidebar.expand')} side="right">
            <button
              onClick={toggleCollapsed}
              aria-label={t('sidebar.expand')}
              title={t('sidebar.expand')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-card hover:text-text"
            >
              <Icon name={ICONS.actions.menuOpen} size={18} />
            </button>
          </Tooltip>
        </div>
      )}
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

  // Swipe kanan dari tepi layar → buka drawer (non-desktop).
  useSwipeGesture({
    window: true,
    onSwipeRight: () => { if (!isDesktop) setSidebarOpen(true); },
    enabled: !isDesktop,
  });
  // Swipe kiri di dalam drawer → tutup.
  const { ref: drawerRef } = useSwipeGesture({
    onSwipeLeft: () => setSidebarOpen(false),
    enabled: sidebarOpen && !isDesktop,
  });

  // Tutup drawer saat Esc.
  useEffect(() => {
    if (!sidebarOpen || isDesktop) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, isDesktop, setSidebarOpen]);

  // Desktop: sidebar in-flow dengan lebar ter-animasi (collapse/expand).
  if (isDesktop) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? RAIL_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 h-screen shrink-0"
      >
        <SidebarContent collapsed={collapsed} />
      </motion.aside>
    );
  }

  // Non-desktop: rail 68px di flow (tablet) + drawer overlay saat dibuka.
  return (
    <>
      {showRailInFlow && (
        <aside className="relative z-20 h-screen w-[68px] shrink-0">
          <SidebarContent collapsed />
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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />,
          <motion.aside
            key="sidebar-drawer"
            ref={drawerRef}
            initial={{ x: -EXPANDED_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -EXPANDED_WIDTH }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-[260px] touch-pan-y"
          >
            <SidebarContent collapsed={false} onNavigate={() => setSidebarOpen(false)} />
          </motion.aside>,
        ]}
      </AnimatePresence>
    </>
  );
}
