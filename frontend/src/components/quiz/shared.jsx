export function formatDuration(seconds, t) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return t('quiz.durationFormat', { minutes: m, seconds: String(s).padStart(2, '0') });
}