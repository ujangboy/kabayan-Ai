import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Icon, Tooltip } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';
import { useAppStore, useUiStore } from '@/store';
import { subjectAPI, flashcardAPI, sessionsAPI } from '@/services/api';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import StorageMeter from './StorageMeter';

const EXPANDED_WIDTH = 260;
const RAIL_WIDTH = 72;
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
  { to: '/exam-analyzer', icon: ICONS.nav.exam, labelKey: 'nav.exam', group: 'exam' },
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

  // Subjects tetap di-fetch saat collapsed agar flyout materi/exam tetap terisi (tanpa count badge)
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then((r) => r.data),
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

  // Flyout state untuk collapsed rail (materi & exam)
  const [flyoutGroup, setFlyoutGroup] = useState(null);
  const [flyoutRect, setFlyoutRect] = useState(null);
  const flyoutTimeoutRef = useState(() => ({ current: null }))[0];

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

  // Store filter untuk penanda aktif yang persist setelah URL dibersihkan (MateriPage & ExamAnalyzerPage clear query)
  const subjectFilterMateri = useUiStore((s) => s.subjectFilterMateri);
  const subjectFilterExam = useUiStore((s) => s.subjectFilterExam);

  const submenuItems = (group) => {
    if (group === 'subjects') {
      return subjectList.map((s) => ({ key: `s-${s.id}`, label: s.name, to: `/subjects/${s.id}`, icon: ICONS.files.folder, active: location.pathname === `/subjects/${s.id}` }));
    }
    if (group === 'materi') {
      const urlSid = new URLSearchParams(location.search).get('subject_id');
      return subjectList.map((s) => ({ key: `m-${s.id}`, label: s.name, to: `/materi?subject_id=${s.id}`, icon: ICONS.files.folder, active: urlSid === String(s.id) || (location.pathname.startsWith('/materi') && subjectFilterMateri === String(s.id)) }));
    }
    if (group === 'exam') {
      const urlSid = new URLSearchParams(location.search).get('subject_id');
      return subjectList.map((s) => ({ key: `ex-${s.id}`, label: s.name, to: `/exam-analyzer?subject_id=${s.id}`, icon: ICONS.files.folder, active: urlSid === String(s.id) || (location.pathname === '/exam-analyzer' && subjectFilterExam === String(s.id)) }));
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
        label: s.subject_name || t('studyPlanPage.noSessionTitle', 'Rencana Belajar'),
        to: `/study-plan?session_id=${s.id}`,
        icon: ICONS.nav.studyPlan,
        active: new URLSearchParams(location.search).get('session_id') === String(s.id),
      }));
    }
    return [];
  };

  const flyoutGroups = new Set(['materi', 'exam']);
  const shouldShowFlyout = (group) => collapsed && flyoutGroups.has(group);

  const handleNav = (to) => {
    navigate(to);
    onNavigate?.();
  };

  const renderTopItem = (item) => {
    const active = isActive(item.to, location.pathname);
    const hasGroup = !!item.group;
    const groupOpen = openGroups.has(item.group);
    const isFlyout = shouldShowFlyout(item.group);

    const openFlyout = (e) => {
      if (!isFlyout) return;
      if (flyoutTimeoutRef.current) {
        clearTimeout(flyoutTimeoutRef.current);
        flyoutTimeoutRef.current = null;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      setFlyoutRect(rect);
      setFlyoutGroup(item.group);
    };
    const scheduleClose = () => {
      if (!isFlyout) return;
      if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = setTimeout(() => {
        setFlyoutGroup(null);
        setFlyoutRect(null);
      }, 140);
    };
    const cancelClose = () => {
      if (flyoutTimeoutRef.current) {
        clearTimeout(flyoutTimeoutRef.current);
        flyoutTimeoutRef.current = null;
      }
    };

    const row = (
      <div className="relative flex items-center">
        {active && (
          <motion.span
            layoutId="nav-active-indicator"
            className="absolute left-0 top-0 bottom-0 my-auto h-6 w-[3px] rounded-full bg-primary"
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
            className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover hover:text-text"
          >
            <motion.span animate={{ rotate: groupOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <Icon name={ICONS.actions.expand} size={16} />
            </motion.span>
          </button>
        )}
      </div>
    );

    let wrapped;
    if (collapsed) {
      if (isFlyout) {
        wrapped = (
          <div onMouseEnter={openFlyout} onMouseLeave={scheduleClose}>
            {row}
          </div>
        );
      } else {
        wrapped = (
          <Tooltip label={t(item.labelKey)} side="right">
            <div>{row}</div>
          </Tooltip>
        );
      }
    } else {
      wrapped = row;
    }

    return (
      <div key={item.to} onMouseEnter={isFlyout ? cancelClose : undefined} onMouseLeave={isFlyout ? scheduleClose : undefined}>
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
                  <div className="space-y-0.5 pr-1">
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
                        <Tooltip label={sub.label}>
                          <span className="truncate">{sub.label}</span>
                        </Tooltip>
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

  // Flyout card untuk collapsed rail — hanya materi & exam, tanpa count, ellipsis 200px
  const activeFlyoutItems = flyoutGroup ? submenuItems(flyoutGroup) : [];
  const flyoutLabelKey = flyoutGroup ? NAV.find((n) => n.group === flyoutGroup)?.labelKey : null;

  return (
    <div className="flex h-full flex-col bg-sidebar divider-gradient-r">
      {/* Logo + toggle selalu di atas. Expanded: logo kiri + toggle kanan.
          Collapsed/rail: logo disembunyi, toggle bentangkan menempati posisi logo di atas
          (tidak ditumpuk di bawah logo). */}
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-card">
              <Icon name={ICONS.communication.bot} size={20} className="relative text-white" />
            </div>
            <span className="text-base font-semibold text-text">Kabayan AI</span>
          </div>
        )}
        <Tooltip label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')} side="right">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className={cn('flex items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-card hover:text-text', collapsed ? 'h-10 w-10' : 'h-9 w-9')}
          >
            <Icon name={collapsed ? ICONS.actions.menuOpen : ICONS.actions.menu} size={18} />
          </button>
        </Tooltip>
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

      {/* Nav utama — single root scrollbar, no nested scroll */}
      <nav className="sidebar-scroll flex-1 min-h-0 space-y-1 overflow-y-auto px-3">
        {NAV.map(renderTopItem)}
      </nav>

      {/* Flyout card untuk collapsed rail — materi & exam, tanpa count */}
      <AnimatePresence>
        {collapsed && flyoutGroup && flyoutRect && (
          <motion.div
            key={flyoutGroup}
            initial={{ opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => {
              if (flyoutTimeoutRef.current) {
                clearTimeout(flyoutTimeoutRef.current);
                flyoutTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => {
              setFlyoutGroup(null);
              setFlyoutRect(null);
            }}
            style={{
              position: 'fixed',
              left: flyoutRect.left + flyoutRect.width + 10,
              top: Math.max(12, Math.min(flyoutRect.top - 8, typeof window !== 'undefined' ? window.innerHeight - 340 : flyoutRect.top)),
              zIndex: 60,
            }}
            className="w-[240px] rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-modal overflow-hidden"
          >
            <div className="px-3.5 py-3 border-b border-border flex items-center gap-2">
              <Icon name={NAV.find((n) => n.group === flyoutGroup)?.icon || ICONS.files.folder} size={16} className="text-primary-light shrink-0" />
              <span className="text-base font-semibold text-text truncate">{flyoutLabelKey ? t(flyoutLabelKey) : ''}</span>
              <span className="ml-auto text-2xs text-text-muted">{activeFlyoutItems.length}</span>
            </div>
            <div className="p-2 max-h-[320px] overflow-y-auto sidebar-scroll">
              {activeFlyoutItems.length === 0 ? (
                <p className="px-2.5 py-6 text-center text-xs text-text-muted">{t('subjects.empty')}</p>
              ) : (
                <div className="space-y-0.5">
                  {activeFlyoutItems.map((sub) => (
                    <button
                      key={sub.key}
                      onClick={() => handleNav(sub.to)}
                      className={cn(
                        'group/item flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-150',
                        sub.active
                          ? 'bg-primary/15 text-primary-light'
                          : 'text-text-secondary hover:bg-card hover:text-text hover:translate-x-[1px]'
                      )}
                    >
                      <Icon name={sub.icon} size={14} className={cn('shrink-0 transition-colors', sub.active ? 'text-primary-light' : 'text-text-muted group-hover/item:text-text-secondary')} />
                      <Tooltip label={sub.label}>
                        <span className="truncate max-w-[200px]">{sub.label}</span>
                      </Tooltip>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sticky area — pengaturan + storage meter */}
      <div className="shrink-0 mt-auto border-t border-border bg-sidebar">
        <div className="px-3 pt-2 pb-1">
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
        {!collapsed && <StorageMeter />}
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

  // Non-desktop: rail 72px di flow (tablet) + drawer overlay saat dibuka.
  return (
    <>
      {showRailInFlow && (
        <aside className="relative z-20 h-screen w-[72px] shrink-0">
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