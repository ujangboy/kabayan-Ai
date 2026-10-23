import i18n from '@/i18n';

export const TYPE_META = {
  review:     { labelKey: 'studyPlanPage.typeReview',     cls: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  practice:   { labelKey: 'studyPlanPage.typePractice',   cls: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20' },
  simulation: { labelKey: 'studyPlanPage.typeSimulation', cls: 'bg-warning/15 text-warning border-warning/30' },
  rest:       { labelKey: 'studyPlanPage.typeRest',       cls: 'bg-success/10 text-success border-success/20' },
};

function dateLocale() {
  return i18n.language === 'en' ? 'en-US' : 'id-ID';
}

// Parse "YYYY-MM-DD" (start_date dari kolom Date DB, date-only) sebagai tanggal
// LOKAL — new Date('2026-10-23') memperlakukannya UTC-tengah malam sehingga di
// zona negatif bisa mundur sehari. Format lain → new Date() biasa.
function parseDateOnly(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatItemDate(startDateStr, orderNumber) {
  const d = parseDateOnly(startDateStr);
  if (!d) return '';
  d.setDate(d.getDate() + orderNumber);
  return new Intl.DateTimeFormat(dateLocale(), {
    weekday: 'long', day: 'numeric', month: 'short',
  }).format(d);
}

// Versi ringkas untuk baris preview rencana di ResultView (muat di w-12).
export function formatDayShort(startDateStr, orderNumber) {
  const d = parseDateOnly(startDateStr);
  if (!d) return '';
  d.setDate(d.getDate() + orderNumber);
  return new Intl.DateTimeFormat(dateLocale(), {
    day: 'numeric', month: 'short',
  }).format(d);
}

export function formatRealDate(isoStr, t) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return t ? t('common.today') : 'Today';
  if (sameDay(d, yesterday)) return t ? t('common.yesterday') : 'Yesterday';
  return new Intl.DateTimeFormat(dateLocale(), {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}
