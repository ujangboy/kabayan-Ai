import { useTranslation } from 'react-i18next';

export default function QuizProgressBar({ current, total }) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-text-secondary">
          {t('quizProgress.questionOf', { current, total })}
        </span>
        <span className="text-xs font-bold text-primary">{pct}%</span>
      </div>
      <div className="h-2.5 bg-background rounded-full overflow-hidden border border-border/50">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
