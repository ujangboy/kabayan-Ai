import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { flashcardAPI } from '@/services/api';
import { extractErrorMessage } from '@/utils/errors';
import MaterialPicker from '@/components/MaterialPicker';
import { Select, Modal, Button , Icon } from '@/components/ui';
import { usePendingOperation } from '@/hooks/usePendingOperation';

export default function GenerateAIModal({ open, subjects, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [count, setCount] = useState(10);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const flashcardOp = usePendingOperation('flashcard');

  const PRESETS = [5, 10, 15, 20];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError(t('flashcard.selectSubjectFirst'));
    if (selectedMaterialIds.length === 0) return setError(t('flashcard.selectMaterialFirst'));
    setError('');
    setIsGenerating(true);
    flashcardOp.start();
    try {
      const result = await flashcardAPI.generate({
        subject_id: Number(subjectId),
        count: Math.max(5, Math.min(20, Number(count) || 10)),
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : '',
      });
      if (result.detail) throw new Error(result.detail);
      const batchId = result?.batch_id;
      onSuccess(batchId);
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsGenerating(false);
    } finally {
      flashcardOp.finish();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><Icon name={ICONS.ui.bolt} size={18} className="text-primary" />{t('flashcard.generateAiModalTitle')}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>{t('common.cancel')}</Button>
          <Button type="submit" form="ai-gen-form" loading={isGenerating} disabled={!subjectId || selectedMaterialIds.length === 0}>
            {t('flashcard.generate')}
          </Button>
        </>
      }
    >
      <form id="ai-gen-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.materialSourceLabel')}</label>
          <Select
            required
            value={subjectId}
            onChange={(e) => { setSubjectId(e.target.value); setSelectedMaterialIds([]); }}
            disabled={isGenerating}
          >
            <option value="">{t('flashcard.selectSubjectPlaceholder')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <p className="text-3xs text-text-muted mt-1">
            {t('flashcard.materialReadyHint')}
          </p>
        </div>
        <MaterialPicker
          subjectId={subjectId}
          selectedMaterialIds={selectedMaterialIds}
          onSelectionChange={setSelectedMaterialIds}
        />
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.countLabel')}</label>
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                disabled={isGenerating}
                onClick={() => setCount(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                  count === p
                    ? 'bg-primary text-white border-primary'
                    : 'bg-background text-text-secondary border-border hover:border-primary/50 hover:text-text'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-3xs text-text-muted mt-1">{t('flashcard.generatePerDeckHint')}</p>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-primary py-1">
            <Icon name={ICONS.status.loading} size={16} className="animate-spin" />
            <span>{t('flashcard.aiAnalyzing')}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}