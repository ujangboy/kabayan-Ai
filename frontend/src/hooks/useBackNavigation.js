import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * useBackNavigation — unified back navigation (PRD-01 §5.2).
 *
 * Prioritas tujuan "kembali" (paling relevan dulu):
 *   1. Param URL `from` (mis. `/materi?from=/subjects/123`)
 *   2. `document.referrer` (hanya same-origin & bukan halaman saat ini)
 *   3. Route induk (parent) berdasarkan pathname
 *   4. Fallback (default `/dashboard`)
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

  const getFromParam = useCallback(() => {
    const from = searchParams.get('from');
    return from && from !== location.pathname ? from : null;
  }, [searchParams, location.pathname]);

  const getReferrer = useCallback(() => {
    if (!document.referrer) return null;
    try {
      const refUrl = new URL(document.referrer, window.location.origin);
      if (refUrl.origin !== window.location.origin) return null;
      if (refUrl.pathname === location.pathname) return null;
      return refUrl.pathname + refUrl.search;
    } catch {
      return null;
    }
  }, [location.pathname]);

  const back = useCallback(() => {
    const from = getFromParam();
    if (from) {
      navigate(from);
      return;
    }
    const referrer = getReferrer();
    if (referrer) {
      navigate(referrer);
      return;
    }
    const parent = getParentRoute(location.pathname);
    if (parent) {
      navigate(parent);
      return;
    }
    navigate(fallback);
  }, [getFromParam, getReferrer, location.pathname, navigate, fallback]);

  const canGoBack = useMemo(
    () => Boolean(getFromParam() || getReferrer() || getParentRoute(location.pathname)),
    [getFromParam, getReferrer, location.pathname]
  );

  return { back, canGoBack };
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