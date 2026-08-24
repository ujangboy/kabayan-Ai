import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * resolveBackDestination — tentukan tujuan "kembali" (PRD-01 §5.2).
 *
 * Prioritas (paling relevan dulu):
 *   1. Param URL `from` (mis. `/materi?from=/subjects/123`)
 *   2. `document.referrer` (hanya same-origin & bukan halaman saat ini)
 *   3. Route induk (parent) berdasarkan pathname
 *   4. Fallback (default `/dashboard`)
 *
 * Dipakai bersama oleh `useBackNavigation` (hook) dan `BackButton` (komponen)
 * agar logika tujuan selalu konsisten di satu tempat.
 *
 * @param {Object} [options]
 * @param {string} [options.pathname] Pathname aktif (tanpa query).
 * @param {URLSearchParams|null} [options.searchParams] Param URL aktif.
 * @param {string} [options.referrer=''] `document.referrer` saat itu.
 * @param {string} [options.fallback='/dashboard'] Tujuan akhir bila tidak ada
 *   jalur lain yang cocok.
 * @returns {string} Route tujuan back.
 */
export function resolveBackDestination({
  pathname = '',
  searchParams = null,
  referrer = '',
  fallback = '/dashboard',
} = {}) {
  const from = searchParams?.get?.('from');
  if (from && from !== pathname) return from;

  if (referrer) {
    try {
      const refUrl = new URL(referrer, window.location.origin);
      if (refUrl.origin === window.location.origin && refUrl.pathname !== pathname) {
        return refUrl.pathname + refUrl.search;
      }
    } catch {
      /* referrer tidak valid — abaikan */
    }
  }

  const parent = getParentRoute(pathname);
  if (parent) return parent;

  return fallback;
}

/**
 * useBackNavigation — unified back navigation (PRD-01 §5.2).
 *
 * @param {Object} [options]
 * @param {string} [options.fallback='/dashboard'] Tujuan akhir bila tidak ada
 *   jalur lain yang cocok.
 * @returns {{ back: () => void, canGoBack: boolean }}
 *   - `back`: jalankan navigasi ke tujuan prioritas tertinggi.
 *   - `canGoBack`: apakah ada tujuan yang lebih spesifik dari fallback
 *     (dipakai untuk memutuskan tombol back perlu dirender atau tidak).
 */
export function useBackNavigation({ fallback = '/dashboard' } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const destination = resolveBackDestination({
    pathname: location.pathname,
    searchParams,
    referrer: document.referrer,
    fallback,
  });

  const back = useCallback(() => navigate(destination), [destination, navigate]);
  const canGoBack = useMemo(() => destination !== fallback, [destination, fallback]);

  return { back, canGoBack, destination };
}

/**
 * getRouteLabel — human-readable label untuk route tujuan back (PRD §2.C).
 * Dipakai PageHeaderBack untuk `Kembali ke {{name}}`.
 * Fallback ke dashboard bila tidak dikenali.
 */
export function getRouteLabel(destination, t) {
  if (!destination) return t ? t('nav.dashboard') : 'Dashboard';
  const segs = destination.split('?')[0].split('/').filter(Boolean);
  const first = segs[0] || 'dashboard';
  const map = {
    dashboard: t ? t('nav.dashboard') : 'Dashboard',
    chat: t ? t('nav.chat') : 'Chat',
    subjects: t ? t('nav.subjects') : 'Mata Pelajaran',
    materi: t ? t('nav.materi') : 'Materi',
    notebook: t ? t('nav.notebook') : 'Notebook',
    flashcard: t ? t('nav.flashcard') : 'Flashcard',
    quiz: t ? t('nav.quiz') : 'Quiz',
    'exam-analyzer': t ? t('nav.exam') : 'Exam Analyzer',
    'study-plan': t ? t('nav.studyPlan') : 'Study Plan',
    settings: t ? t('nav.settings') : 'Settings',
  };
  return map[first] || (t ? t('nav.dashboard') : 'Dashboard');
}

/**
 * Route induk dari sebuah pathname — hilangkan segmen terakhir.
 * `/subjects/123/materials` → `/subjects/123`; `/subjects/123` → `/subjects`;
 * `/materi` → null (tidak punya induk).
 */
function getParentRoute(pathname) {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length <= 1) return null;
  segs.pop();
  return '/' + segs.join('/');
}