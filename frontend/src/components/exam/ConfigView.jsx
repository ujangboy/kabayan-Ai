import { useState } from 'react';
import { ClipboardList, Loader2, Brain } from 'lucide-react';
import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import MaterialPicker from '@/components/MaterialPicker';
import {
  EXAM_TYPES, COUNTS, DIFFICULTIES, BLOOMS, Q_TYPES, FOCUSES,
  DURATIONS, Q_TYPE_MAP, SectionHeader,
} from './shared';

export default function ConfigView({ subjectId, analysis, onDone }) {
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
    if (!subjectId) return setError('Pilih mata kuliah terlebih dahulu.');
    if (selectedMaterialIds.length === 0) return setError('Harap pilih materi terlebih dahulu.');
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
      setError(e.response?.data?.detail || e.message || 'Gagal membuat blueprint.');
    } finally { setIsLoading(false); }
  };

  const OptionGroup = ({ label, options, field, renderLabel }) => (
    <div>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = renderLabel ? renderLabel(opt) : String(opt);
          const active = form[field] === opt || form[field] === val;
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
    <div className="card-base p-6 space-y-6">
      <SectionHeader icon={ClipboardList} title="Konfigurasi Simulasi"
        subtitle="Tentukan jenis, format, dan tingkat kesulitan ujian" />

      <OptionGroup label="Jenis Ujian" options={EXAM_TYPES} field="exam_type" />
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Jumlah Soal</p>
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
            placeholder="Jumlah soal..."
            className="mt-2 w-32 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
        )}
      </div>
      <OptionGroup label="Tingkat Kesulitan" options={DIFFICULTIES} field="difficulty" />
      <OptionGroup label="Level Bloom Taxonomy" options={BLOOMS} field="bloom_level" />
      <OptionGroup label="Jenis Soal" options={Q_TYPES} field="question_type" />
      <OptionGroup label="Fokus Materi" options={FOCUSES} field="focus_material" />
      <OptionGroup label="Waktu Pengerjaan" options={DURATIONS} field="duration"
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
            ? <><Loader2 size={14} className="animate-spin" /> Membuat Blueprint...</>
            : <><Brain size={14} /> Generate Blueprint</>}
        </button>
      </div>
    </div>
  );
}
