import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuizTimer({ totalSeconds, onTimeUp, isActive = true }) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(totalSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!isActive || remaining <= 0) {
      if (remaining <= 0) onTimeUpRef.current?.();
      return;
    }
    const timerId = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timerId);
  }, [remaining, isActive]);

  const warning = remaining <= 60;
  const danger = remaining <= 15;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${
        danger
          ? 'bg-danger/15 text-danger border-danger/30 animate-pulse'
          : warning
            ? 'bg-warning/15 text-warning border-warning/30'
            : 'bg-card text-text-secondary border-border'
      }`}
      title={t('quizTimer.remainingTime')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {formatTime(Math.max(0, remaining))}
    </span>
  );
}
