import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import MaterialPicker from '@/components/MaterialPicker';
import {
  EXAM_TYPES, COUNTS, DIFFICULTIES, BLOOMS, Q_TYPES, FOCUSES,
  DURATIONS, Q_TYPE_MAP, SectionHeader,
} from './shared';

export default function ConfigView({ subjectId, analysis, onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    exam_type: 'UTS',
    total_questions: 20,
    custom_count: '',
    difficulty: 'Menengah',
    bloom_level: 'Mixed',
    question_type: 'Campuran',
    focus_material: 'Semua Materi',
    duration: DURATIONS[2],
  });
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!subjectId) return setError(t('exam.config.selectSubjectFirst'));
    if (selectedMaterialIds.length === 0) return setError(t('exam.config.selectMaterialFirst'));
    setError(''); setIsLoading(true);
    try {
      const totalQ = form.total_questions === 'custom'
        ? parseInt(form.custom_count) || 10
        : form.total_questions;

      const payload = {
        subject_id: subjectId,
        exam_type: form.exam_type.toLowerCase().replace(' ', '_'),
        total_questions: totalQ,
        difficulty: form.difficulty.toLowerCase(),
        bloom_level: form.bloom_level.toLowerCase(),
        question_type: Q_TYPE_MAP[form.question_type] || 'mixed',
        focus_material: form.focus_material,
        duration_minutes: form.duration.value,
        analysis_json: analysis ? JSON.stringify(analysis) : undefined,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : undefined,
      };
      const r = await examAPI.generateBlueprint(payload);
      if (r.data?.detail) throw new Error(r.data.detail);
      onDone(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('exam.config.failedBlueprint'));
    } finally { setIsLoading(false); }
  };

  const OptionGroup = ({ label, options, field, renderLabel }) => (
    <div>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = renderLabel ? renderLabel(opt) : String(opt);
          const formVal = form[field];
          const active = formVal === opt || formVal === val || (formVal?.value && formVal.value === val);
          return (
            <button key={lbl} onClick={() => set(field, opt)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                active ? 'bg-primary text-white border-primary shadow-glow' : 'bg-card text-text border-border hover:border-primary/40')}>
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <SectionHeader icon={ICONS.status.pending} title={t('exam.config.title')}
        subtitle={t('exam.config.subtitle')} />

      <OptionGroup label={t('exam.config.examTypeLabel')} options={EXAM_TYPES} field="exam_type" />
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('exam.config.questionCountLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {[...COUNTS, 'custom'].map(c => (
            <button key={c} onClick={() => set('total_questions', c)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                form.total_questions === c ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {c === 'custom' ? 'Custom' : c}
            </button>
          ))}
        </div>
        {form.total_questions === 'custom' && (
          <input type="number" min="1" max="100" value={form.custom_count}
            onChange={e => set('custom_count', e.target.value)}
            placeholder={t('exam.config.questionCountPlaceholder')}
            className="mt-2 w-32 input-base" />
        )}
      </div>
      <OptionGroup label={t('exam.config.difficultyLabel')} options={DIFFICULTIES} field="difficulty" />
      <OptionGroup label={t('exam.config.bloomLabel')} options={BLOOMS} field="bloom_level" />
      <OptionGroup label={t('exam.config.questionTypeLabel')} options={Q_TYPES} field="question_type" />
      <OptionGroup label={t('exam.config.focusLabel')} options={FOCUSES} field="focus_material" />
      <OptionGroup label={t('exam.config.durationLabel')} options={DURATIONS} field="duration"
        renderLabel={d => d.label} />

      <MaterialPicker
        subjectId={subjectId}
        selectedMaterialIds={selectedMaterialIds}
        onSelectionChange={setSelectedMaterialIds}
      />

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex justify-end pt-2">
        <button onClick={handleSubmit} disabled={isLoading || selectedMaterialIds.length === 0} className="btn-primary">
          {isLoading
            ? <><Icon name={ICONS.status.loading} size={14} className="animate-spin" /> {t('exam.config.creatingBlueprint')}</>
            : <><Icon name={ICONS.learning.brain} size={14} /> {t('exam.config.generateBlueprint')}</>}
        </button>
      </div>
    </div>
  );
}
