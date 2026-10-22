import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';

import { examAPI } from '@/services/api';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
import { useJobStore } from '@/store/jobStore';
import { usePageStateStore } from '@/store/pageStateStore';
import { cn } from '@/utils';
import MaterialPicker from '@/components/MaterialPicker';
import {
  EXAM_TYPES, COUNTS, DIFFICULTIES, BLOOMS, Q_TYPES, FOCUSES,
  DURATIONS, Q_TYPE_MAP, SectionHeader, unwrapJobPayload,
} from './shared';

const PAGE_KEY = 'exam-analyzer';
const JOB_KEY = 'exam-blueprint';

export default function ConfigView({ subjectId, analysis, onDone }) {
  const { t } = useTranslation();
  const { run: runJob } = useBackgroundJob();
  const jobRunning = useJobStore((s) => Boolean(s.jobs[JOB_KEY]));
  const blueprintResult = useJobStore((s) => s.results[JOB_KEY]);
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

  // Kalau user kembali ke modal ini saat job masih berjalan, tampilkan state loading.
  useEffect(() => {
    if (jobRunning) setIsLoading(true);
  }, [jobRunning]);

  // Hasil disimpan di jobStore agar tetap bisa diambil setelah komponen unmount.
  useEffect(() => {
    if (!blueprintResult) return;
    const entry = useJobStore.getState().takeResult(JOB_KEY);
    if (!entry) return;
    setIsLoading(false);
    if (entry.status !== 'success') {
      setError(entry.result?.message || t('exam.config.failedBlueprint'));
      return;
    }
    const data = unwrapJobPayload(entry.result);
    if (data?.detail) {
      setError(data.detail);
      return;
    }
    const store = usePageStateStore.getState();
    const saved = store.load(PAGE_KEY) || {};
    store.save(PAGE_KEY, {
      ...saved,
      blueprint: data,
      blueprintModal: data,
      configOpen: false,
      updatedAt: Date.now(),
    });
    onDone?.(data);
  }, [blueprintResult, onDone, t]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const OPTION_KEYS = {
    'Latihan Harian': 'exam.config.examDaily',
    'Quiz': 'exam.config.examQuiz',
    'UTS': 'exam.config.examUts',
    'UAS': 'exam.config.examUas',
    'Custom': 'exam.config.examCustom',
    'Pemula': 'exam.config.difficultyBeginner',
    'Menengah': 'exam.config.difficultyIntermediate',
    'Sulit': 'exam.config.difficultyHard',
    'Campuran': 'exam.config.typeMixed',
    'Pilihan Ganda': 'exam.config.typeMcq',
    'Benar / Salah': 'exam.config.typeTrueFalse',
    'Isian Singkat': 'exam.config.typeShortAnswer',
    'Essay': 'exam.config.typeEssay',
    'Studi Kasus': 'exam.config.typeCaseStudy',
    'Analisis': 'exam.config.typeAnalysis',
    'Perhitungan': 'exam.config.typeCalculation',
    'Semua Materi': 'exam.config.focusAll',
    'Bab Tertentu': 'exam.config.focusChapter',
    'Topik Tertentu': 'exam.config.focusTopic',
    'Materi Lemah': 'exam.config.focusWeak',
    'Materi Favorit': 'exam.config.focusFavorite',
  };
  const localizeOption = (opt) => {
    const key = OPTION_KEYS[String(opt)];
    return key ? t(key) : String(opt);
  };

  const handleSubmit = () => {
    if (!subjectId) return setError(t('exam.config.selectSubjectFirst'));
    if (selectedMaterialIds.length === 0) return setError(t('exam.config.selectMaterialFirst'));
    setError(''); setIsLoading(true);

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

    // Job berjalan di store global: pindah menu tidak membatalkan request.
    useJobStore.getState().clearResult('exam-questions');
    runJob(JOB_KEY, t('appLayout.opExamBlueprint'), (signal) =>
      examAPI.generateBlueprint(payload, { signal }), {
      storeResult: true,
      onError: (e) => {
        setIsLoading(false);
        setError(e.response?.data?.detail || e.message || t('exam.config.failedBlueprint'));
      },
    }).catch(() => { /* error sudah ditangani onError */ });
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
                active ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
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

      <OptionGroup label={t('exam.config.examTypeLabel')} options={EXAM_TYPES} field="exam_type" renderLabel={localizeOption} />
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('exam.config.questionCountLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {[...COUNTS, 'custom'].map(c => (
            <button key={c} onClick={() => set('total_questions', c)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                form.total_questions === c ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {c === 'custom' ? t('exam.config.countCustom') : c}
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
      <OptionGroup label={t('exam.config.difficultyLabel')} options={DIFFICULTIES} field="difficulty" renderLabel={localizeOption} />
      <OptionGroup label={t('exam.config.bloomLabel')} options={BLOOMS} field="bloom_level" renderLabel={opt => t(`exam.config.bloom${opt}`)} />
      <OptionGroup label={t('exam.config.questionTypeLabel')} options={Q_TYPES} field="question_type" renderLabel={localizeOption} />
      <OptionGroup label={t('exam.config.focusLabel')} options={FOCUSES} field="focus_material" renderLabel={localizeOption} />
      <OptionGroup label={t('exam.config.durationLabel')} options={DURATIONS} field="duration"
        renderLabel={d => t(`exam.config.duration${d.value ?? 'Unlimited'}`)} />

      <MaterialPicker
        subjectId={subjectId}
        selectedMaterialIds={selectedMaterialIds}
        onSelectionChange={setSelectedMaterialIds}
      />

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={isLoading || selectedMaterialIds.length === 0} className="" variant="primary">
          {isLoading
            ? <><Icon name={ICONS.status.loading} size={14} className="animate-spin" /> {t('exam.config.creatingBlueprint')}</>
            : <><Icon name={ICONS.learning.brain} size={14} /> {t('exam.config.generateBlueprint')}</>}
        </Button>
      </div>
    </div>
  );
}