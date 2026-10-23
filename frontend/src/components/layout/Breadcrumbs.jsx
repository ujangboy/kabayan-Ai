import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip } from '@/components/ui';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { subjectAPI } from '@/services/api';

// Crumb = { to, label, icon?, current? } | { ellipsis: true }
function buildCrumbs(pathname, t, subjectName) {
  const segs = pathname.split('/').filter(Boolean);
  const crumbs = [];

  if (segs.length === 0) return crumbs;

  const [first, second] = segs;

  // Semua halaman punya akar "Dashboard/Home" — kecuali dashboard itu sendiri.
  if (first !== 'dashboard') {
    crumbs.push({ to: '/dashboard', label: t('nav.dashboard'), icon: ICONS.nav.dashboard });
  }

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

  if (labelFor[first]) {
    crumbs.push({ to: `/${first}`, ...labelFor[first] });
  }

  // Deep segment: subjects/:id dan flashcard/review.
  if (first === 'subjects' && second) {
    crumbs.push({
      to: `/subjects/${second}`,
      label: subjectName || t('breadcrumb.loading'),
    });
  } else if (first === 'flashcard' && second) {
    crumbs.push({ to: '/flashcard/review', label: t('breadcrumb.flashcardReview') });
  }

  // Tandai crumb terakhir sebagai halaman aktif.
  if (crumbs.length > 0) crumbs[crumbs.length - 1].current = true;

  return crumbs;
}

// Jika jumlah crumb melebihi maxItems, kolaps bagian tengah jadi "...".
function collapseCrumbs(crumbs, maxItems) {
  if (crumbs.length <= maxItems) return crumbs;
  const head = crumbs.slice(0, 1);
  const tail = crumbs.slice(-(maxItems - 2));
  return [...head, { ellipsis: true }, ...tail];
}

export default function Breadcrumbs({ maxItems = 4 }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const segs = pathname.split('/').filter(Boolean);
  const subjectId = segs[0] === 'subjects' ? Number(segs[1]) || null : null;

  // Subscribe to the same query used by SubjectDashboardPage. Reading the
  // query cache directly would not re-render when the dashboard request
  // resolves, leaving the crumb stuck on "Memuat...".
  const { data: subjectDashboard } = useQuery({
    queryKey: ['subject-dashboard', subjectId],
    queryFn: () => subjectAPI.getDashboard(subjectId).then((res) => res.data),
    enabled: !!subjectId,
  });
  const subjectName = subjectDashboard?.subject?.name || null;

  // Halaman root sudah punya judul sendiri; breadcrumb hanya berguna saat
  // pengguna masuk lebih dalam (mis. detail mata kuliah / review flashcard).
  if (segs.length <= 1) return null;

  const crumbs = collapseCrumbs(buildCrumbs(pathname, t, subjectName), maxItems);
  if (crumbs.length === 0) return null;

  return (
    <motion.nav
      aria-label={t('breadcrumb.label')}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="hidden sm:flex shrink-0 items-center gap-0.5 px-4 py-1.5 min-h-0"
    >
      {crumbs.map((crumb, i) => {
        if (crumb.ellipsis) {
          return (
            <Fragment key={`ellipsis-${i}`}>
              <Icon name={ICONS.ui.chevronRight} size={12} className="shrink-0 text-text-muted/50" />
              <Tooltip label={t('breadcrumb.more')}>
                <span
                  aria-hidden="true"
                  className="px-1 text-xs text-text-muted select-none"
                >
                  …
                </span>
              </Tooltip>
            </Fragment>
          );
        }

        const icon = crumb.icon ? (
          <Icon name={crumb.icon} size={13} className="shrink-0 text-primary-light" />
        ) : null;

        return (
          <Fragment key={crumb.to + i}>
            {i > 0 && <Icon name={ICONS.ui.chevronRight} size={12} className="shrink-0 text-text-muted/50" />}
            {crumb.current ? (
              <Tooltip label={crumb.label}>
                <span
                  aria-current="page"
                  className="flex max-w-[180px] items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-xs font-medium text-text cursor-default"
                >
                  {icon}
                  <span className="truncate">{crumb.label}</span>
                </span>
              </Tooltip>
            ) : (
              <Tooltip label={crumb.label}>
                <Link
                  to={crumb.to}
                  className="flex max-w-[180px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-text-secondary transition-colors hover:bg-card hover:text-text hover:underline"
                >
                  {icon}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              </Tooltip>
            )}
          </Fragment>
        );
      })}
    </motion.nav>
  );
}