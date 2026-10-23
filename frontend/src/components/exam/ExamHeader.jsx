import { useTranslation } from 'react-i18next';

import { VIEW } from '@/components/exam/shared';
import { ICONS } from '@/lib/icons';
import { Tooltip, Select, HelpTip , Icon , Button} from '@/components/ui';

export default function ExamHeader({ view, subjectId, subjects, canCreate, onBack, onSubjectChange, onCreate }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {view !== VIEW.DASHBOARD && subjectId && (
          <Tooltip label={t('common.back')}>
            <button onClick={onBack} aria-label={t('common.back')} className="p-1.5 rounded-lg hover:bg-card text-text-secondary transition-colors">
              <Icon name={ICONS.ui.chevronLeft} size={18} />
            </button>
          </Tooltip>
        )}
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Icon name={ICONS.learning.brain} size={22} className="text-primary" />
            {t('exam.title')}
            <Tooltip label={t('exam.adaptiveBadgeHint')}>
              <span className="badge badge-success text-3xs">
                <Icon name={ICONS.ui.bolt} size={9} className="inline mr-0.5" />
                {t('exam.adaptiveBadge')}
              </span>
            </Tooltip>
            <HelpTip label={t('help.exam')} />
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {t('exam.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Nama mata kuliah panjang terpotong di select native — tampilkan lengkap saat dihover */}
        <Select
          value={subjectId}
          onChange={onSubjectChange}
          title={subjects.find((s) => String(s.id) === String(subjectId))?.name || ''}
        >
          <option value="">{t('exam.selectSubjectPlaceholder')}</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {canCreate && (
          <Button onClick={onCreate} className="shrink-0" variant="primary">
            {t('exam.createSimulation')}
          </Button>
        )}
      </div>
    </div>
  );
}