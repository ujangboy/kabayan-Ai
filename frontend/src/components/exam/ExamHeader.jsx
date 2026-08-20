import { useTranslation } from 'react-i18next';
import { Brain, ChevronLeft, Zap } from '@/icons';
import { VIEW } from '@/components/exam/shared';
import { Tooltip, Select } from '@/components/ui';

export default function ExamHeader({ view, subjectId, subjects, canCreate, onBack, onSubjectChange, onCreate }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {view !== VIEW.DASHBOARD && subjectId && (
          <Tooltip label={t('common.back')}>
            <button onClick={onBack} aria-label={t('common.back')} className="p-1.5 rounded-lg hover:bg-card text-text-secondary transition-colors">
              <ChevronLeft size={18} />
            </button>
          </Tooltip>
        )}
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Brain size={22} className="text-primary" />
            {t('exam.title')}
            <span
              className="badge badge-success text-[10px]"
              title={t('exam.adaptiveBadgeHint')}
            >
              <Zap size={9} className="inline mr-0.5" />
              {t('exam.adaptiveBadge')}
            </span>
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {t('exam.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={subjectId} onChange={onSubjectChange}>
          <option value="">{t('exam.selectSubjectPlaceholder')}</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {canCreate && (
          <button
            onClick={onCreate}
            disabled={!subjectId}
            className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={13} /> {t('exam.createSimulation')}
          </button>
        )}
      </div>
    </div>
  );
}
