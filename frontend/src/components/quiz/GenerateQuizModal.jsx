import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { quizAPI } from '@/services/api';
import { Modal, Button, Select, Input , Icon } from '@/components/ui';
import MaterialPicker from '@/components/MaterialPicker';
import { usePendingOperation } from '@/hooks/usePendingOperation';

export function GenerateQuizModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [mcqCount, setMcqCount] = useState(5);
  const [essayCount, setEssayCount] = useState(0);
  const [difficulty, setDifficulty] = useState('sedang');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const quizOp = usePendingOperation('quiz');

  const DIFFICULTIES = [
    { value: 'mudah',  label: 'quiz.difficultyEasy',   desc: 'quiz.difficultyEasyDesc' },
    { value: 'sedang', label: 'quiz.difficultyMedium', desc: 'quiz.difficultyMediumDesc' },
    { value: 'sulit',  label: 'quiz.difficultyHard',   desc: 'quiz.difficultyHardDesc' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError(t('quiz.errorSubjectRequired'));
    if (selectedMaterialIds.length === 0) return setError(t('quiz.errorMaterialRequired'));
    if (!mcqCount && !essayCount) return setError(t('quiz.errorMinQuestions'));
    setError('');
    setIsGenerating(true);
    quizOp.start();
    try {
      const result = await quizAPI.generate({
        subject_id: subjectId,
        mcq_count: Number(mcqCount) || 0,
        essay_count: Number(essayCount) || 0,
        difficulty,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : '',
      });
      if (result.detail) throw new Error(result.detail);
      if (!result.id) throw new Error(t('quiz.errorMissingId'));
      onSuccess(result.id);
    } catch (err) {
      setError(err.message || t('quiz.errorGenerateFailed'));
    } finally {
      setIsGenerating(false);
      quizOp.finish();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><Icon name={ICONS.ui.bolt} size={18} className="text-primary" />{t('quiz.modalTitle')}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>{t('common.cancel')}</Button>
          <Button type="submit" form="quiz-gen-form" loading={isGenerating} disabled={!subjectId || selectedMaterialIds.length === 0}>
            {isGenerating ? t('quiz.generating') : t('quiz.generateButton')}
          </Button>
        </>
      }
    >
      <form id="quiz-gen-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('quiz.sourceLabel')}</label>
          <Select
            required
            value={subjectId}
            onChange={(e) => { setSubjectId(e.target.value); setSelectedMaterialIds([]); }}
            disabled={isGenerating}
          >
            <option value="">{t('quiz.selectPlaceholder')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <MaterialPicker
          subjectId={subjectId}
          selectedMaterialIds={selectedMaterialIds}
          onSelectionChange={setSelectedMaterialIds}
        />
        {/* Tingkat Kesulitan */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">{t('quiz.difficultyLabel')}</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                type="button"
                disabled={isGenerating}
                onClick={() => setDifficulty(d.value)}
                title={t(d.desc)}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                  difficulty === d.value
                    ? d.value === 'mudah'
                      ? 'bg-success/20 text-success border-success/50'
                      : d.value === 'sedang'
                        ? 'bg-warning/20 text-warning border-warning/50'
                        : 'bg-danger/20 text-danger border-danger/50'
                    : 'bg-background text-text-secondary border-border hover:border-primary/40 hover:text-text'
                }`}
              >
                {t(d.label)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-1">{t(DIFFICULTIES.find(d => d.value === difficulty)?.desc)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Soal Pilihan Ganda</label>
            <Input
              type="number"
              min="0"
              max="15"
              value={mcqCount}
              onChange={(e) => setMcqCount(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Soal Essay</label>
            <Input
              type="number"
              min="0"
              max="5"
              value={essayCount}
              onChange={(e) => setEssayCount(e.target.value)}
              disabled={isGenerating}
            />
          </div>
        </div>
        {Number(essayCount) > 0 && (
          <p className="text-[10px] text-text-muted">
            Soal essay tidak dinilai otomatis — tujuannya untuk latihan menulis jawaban.
          </p>
        )}
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-primary py-1">
            <Icon name={ICONS.status.loading} size={16} className="animate-spin" />
            <span>{t('quiz.analyzing')}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
