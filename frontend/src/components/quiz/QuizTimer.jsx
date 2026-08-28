import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon, Tooltip } from '@/components/ui';


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
    <Tooltip label={t('quizTimer.remainingTime')}>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${
          danger
            ? 'bg-danger/15 text-danger border-danger/30 animate-pulse'
            : warning
              ? 'bg-warning/15 text-warning border-warning/30'
              : 'bg-surface text-text-secondary border-strong'
        }`}
      >
        <Icon name={ICONS.learning.timer} size={13} />
        {formatTime(Math.max(0, remaining))}
      </span>
    </Tooltip>
  );
}