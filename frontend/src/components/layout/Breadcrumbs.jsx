import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, ChevronRight } from '@/icons';
import { cn } from '@/utils';

// Crumb = { to, label, current }
function buildCrumbs(pathname, t, subjectName) {
  const segs = pathname.split('/').filter(Boolean);
  const crumbs = [];

  if (segs.length === 0) return crumbs;

  const [first, second] = segs;

  // Semua halaman punya akar "Dashboard/Home" — kecuali dashboard itu sendiri.
  if (first !== 'dashboard') {
    crumbs.push({ to: '/dashboard', label: t('nav.dashboard') });
  }

  const labelFor = {
    dashboard: () => t('nav.dashboard'),
    chat: () => t('nav.chat'),
    subjects: () => t('nav.subjects'),
    materi: () => t('nav.materi'),
    notebook: () => t('nav.notebook'),
    flashcard: () => t('nav.flashcard'),
    quiz: () => t('nav.quiz'),
    'exam-analyzer': () => t('nav.exam'),
    'study-plan': () => t('nav.studyPlan'),
    settings: () => t('nav.settings'),
  };

  if (labelFor[first]) {
    crumbs.push({ to: `/${first}`, label: labelFor[first]() });
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

export default function Breadcrumbs() {
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

  const crumbs = buildCrumbs(pathname, t, subjectName);
  if (crumbs.length === 0) return null;

  return (
    <motion.nav
      aria-label={t('breadcrumb.label')}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="flex shrink-0 items-center gap-1 px-4 py-1.5 min-h-0"
    >
      <Link
        to="/dashboard"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-card hover:text-text"
        title={t('nav.dashboard')}
      >
        <LayoutDashboard size={13} />
      </Link>

      {crumbs.map((crumb, i) => (
        <Fragment key={crumb.to + i}>
          <ChevronRight size={12} className="shrink-0 text-text-muted/50" />
          <Link
            to={crumb.to}
            aria-current={crumb.current ? 'page' : undefined}
            className={cn(
              'max-w-[180px] truncate rounded-md px-1.5 py-0.5 text-xs transition-colors',
              crumb.current
                ? 'font-medium text-text cursor-default'
                : 'text-text-secondary hover:bg-card hover:text-text'
            )}
          >
            {crumb.label}
          </Link>
        </Fragment>
      ))}
    </motion.nav>
  );
}