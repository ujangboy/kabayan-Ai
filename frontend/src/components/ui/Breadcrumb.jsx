import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';

// Crumb = { to, label, icon?, current? } | { ellipsis: true, hidden: Crumb[] }
function buildCrumbs(pathname, t, subjectName) {
  const segs = pathname.split('/').filter(Boolean);
  const crumbs = [];
  if (segs.length === 0) return crumbs;

  const [first, second] = segs;

  const labelFor = {
    dashboard: { label: t('nav.dashboard'), icon: ICONS.nav.dashboard },
    chat: { label: t('nav.chat'), icon: ICONS.nav.chat },
    subjects: { label: t('nav.subjects'), icon: ICONS.nav.subjects },
    materi: { label: t('nav.materi'), icon: ICONS.nav.materials },
    notebook: { label: t('nav.notebook'), icon: ICONS.nav.notebook },
    flashcard: { label: t('nav.flashcard'), icon: ICONS.nav.flashcard },
    quiz: { label: t('nav.quiz'), icon: ICONS.nav.quiz },
    'exam-analyzer': { label: t('nav.exam'), icon: ICONS.nav.exam },
    'study-plan': { label: t('nav.studyPlan'), icon: ICONS.nav.studyPlan },
    settings: { label: t('nav.settings'), icon: ICONS.nav.settings },
  };

  // Akar Dashboard/Home, kecuali halaman dashboard itu sendiri.
  if (first !== 'dashboard') {
    crumbs.push({ to: '/dashboard', label: t('nav.dashboard'), icon: ICONS.nav.dashboard });
  }

  if (labelFor[first]) {
    crumbs.push({ to: `/${first}`, ...labelFor[first] });
  }

  // Segmen dalam: subjects/:id, flashcard/review.
  // Hapus teks statis "Memuat..." — saat subjectName belum ada, tampilkan fallback singkat tanpa loading placeholder
  if (first === 'subjects' && second) {
    const label = subjectName || t('nav.subjects');
    crumbs.push({ to: `/subjects/${second}`, label });
  } else if (first === 'flashcard' && second) {
    crumbs.push({ to: '/flashcard/review', label: t('breadcrumb.flashcardReview') });
  }

  if (crumbs.length > 0) crumbs[crumbs.length - 1].current = true;
  return crumbs;
}

// Jika jumlah crumb > maxItems, kolaps bagian tengah jadi "..." (berisi dropdown).
function collapseCrumbs(crumbs, maxItems) {
  if (crumbs.length <= maxItems) return crumbs;
  const head = crumbs.slice(0, 1);
  const tail = crumbs.slice(-(maxItems - 1));
  const hidden = crumbs.slice(1, crumbs.length - (maxItems - 1));
  return [...head, { ellipsis: true, hidden }, ...tail];
}

export default function Breadcrumb({ maxItems = 3 }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  const segs = pathname.split('/').filter(Boolean);
  const subjectId = Number(segs[1]) || null;

  let subjectName = null;
  if (segs[0] === 'subjects' && subjectId) {
    const cached = queryClient.getQueryData(['subject-dashboard', subjectId]);
    subjectName = cached?.subject?.name || null;
  }

  const crumbs = collapseCrumbs(buildCrumbs(pathname, t, subjectName), maxItems);
  if (crumbs.length === 0) return null;

  return (
    <motion.nav
      aria-label={t('breadcrumb.label')}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="flex shrink-0 items-center gap-0.5 overflow-hidden px-4 py-1.5 min-h-0"
    >
      {crumbs.map((crumb, i) => {
        if (crumb.ellipsis) {
          return (
            <Fragment key={`ellipsis-${i}`}>
              <Icon name={ICONS.ui.chevronRight} size={12} className="shrink-0 text-text-muted/50" />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="shrink-0 rounded-md px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-card hover:text-text"
                    aria-label={t('breadcrumb.showAll')}
                    title={t('breadcrumb.more')}
                  >
                    …
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={6}
                    align="start"
                    className="z-50 max-h-64 w-56 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-glass-lg backdrop-blur-md"
                  >
                    {crumb.hidden.map((h) => (
                      <DropdownMenu.Item key={h.to} asChild>
                        <Link
                          to={h.to}
                          className="flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-text-secondary outline-none transition-colors hover:bg-background hover:text-text"
                        >
                          {h.icon && <Icon name={h.icon} size={13} className="shrink-0 text-primary-light" />}
                          <span className="truncate">{h.label}</span>
                        </Link>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </Fragment>
          );
        }

        const icon = crumb.icon ? (
          <Icon name={crumb.icon} size={13} className="shrink-0 text-primary-light" />
        ) : null;

        return (
          <Fragment key={(crumb.to || 'x') + i}>
            <Icon name={ICONS.ui.chevronRight} size={12} className="shrink-0 text-text-muted/50" />
            {crumb.current ? (
              <span
                aria-current="page"
                className="flex max-w-[140px] items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-xs font-medium text-text"
                title={crumb.label}
              >
                {icon}
                <span className="truncate">{crumb.label}</span>
              </span>
            ) : (
              <Link
                to={crumb.to}
                className={cn(
                  'flex max-w-[140px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-text-secondary',
                  'transition-colors hover:bg-card hover:text-text hover:underline'
                )}
                title={crumb.label}
              >
                {icon}
                <span className="truncate">{crumb.label}</span>
              </Link>
            )}
          </Fragment>
        );
      })}
    </motion.nav>
  );
}
