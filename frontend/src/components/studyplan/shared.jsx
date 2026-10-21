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

export function formatItemDate(startDateStr, orderNumber) {
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + orderNumber);
  return new Intl.DateTimeFormat(dateLocale(), {
    weekday: 'long', day: 'numeric', month: 'short',
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