import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { flashcardAPI } from '@/services/api';
import { extractErrorMessage } from '@/utils/errors';
import MaterialPicker from '@/components/MaterialPicker';
import { Select, Modal, Button , Icon } from '@/components/ui';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/utils';

export default function GenerateAIModal({ open, subjects, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [count, setCount] = useState(10);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('new'); // 'new' | 'append'
  const [targetBatchId, setTargetBatchId] = useState('');
  const { run: runJob } = useBackgroundJob();

  const PRESETS = [5, 10, 15, 20];

  // Ambil deck yang sudah ada untuk mata kuliah terpilih (untuk mode append)
  const { data: flashcardsData } = useQuery({
    queryKey: ['flashcards-modal', subjectId],
    queryFn: () => flashcardAPI.getAll().then(r => r.data),
    enabled: !!subjectId && open,
  });

  const existingDecks = useMemo(() => {
    if (!subjectId || !flashcardsData?.flashcards) return [];
    const map = {};
    for (const f of flashcardsData.flashcards) {
      if (String(f.subject?.id) !== String(subjectId)) continue;
      const bid = f.batch_id;
      if (!bid) continue;
      if (!map[bid]) map[bid] = { batch_id: bid, count: 0, latest: f.created_at, title: f.title || null };
      map[bid].count += 1;
      if (!map[bid].latest || (f.created_at || '') > map[bid].latest) map[bid].latest = f.created_at;
    }
    return Object.values(map).sort((a, b) => (b.latest || '').localeCompare(a.latest || ''));
  }, [subjectId, flashcardsData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError(t('flashcard.selectSubjectFirst'));
    if (selectedMaterialIds.length === 0) return setError(t('flashcard.selectMaterialFirst'));
    if (mode === 'append' && !targetBatchId) return setError(t('flashcard.selectDeckFirst'));
    setError('');
    setIsGenerating(true);
    // Generate tetap jalan walau modal ditutup / user pindah menu (job di store).
    runJob('flashcard', t('appLayout.opFlashcard'), (signal) => flashcardAPI.generate({
      subject_id: Number(subjectId),
      count: Math.max(5, Math.min(20, Number(count) || 10)),
      material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : '',
      ...(mode === 'append' && targetBatchId ? { batch_id: targetBatchId } : {}),
    }, { signal }), {
      onError: (err) => { setError(extractErrorMessage(err)); setIsGenerating(false); },
      onDone: (result) => {
        setIsGenerating(false);
        if (!result) return;
        if (result.detail) { setError(result.detail); return; }
        onSuccess(result?.batch_id);
      },
    });
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
            onChange={(e) => { setSubjectId(e.target.value); setSelectedMaterialIds([]); setTargetBatchId(''); }}
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
        {existingDecks.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.deckModeLabel')}</label>
            <div className="flex gap-2">
              {[
                { v: 'new', l: t('flashcard.deckNew') },
                { v: 'append', l: t('flashcard.deckAppend') },
              ].map(opt => (
                <button key={opt.v} type="button" disabled={isGenerating}
                  onClick={() => setMode(opt.v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                    mode === opt.v ? 'bg-primary-solid text-white border-primary-solid' : 'bg-background text-text-secondary border-border hover:border-primary/50 hover:text-text'
                  }`}>
                  {opt.l}
                </button>
              ))}
            </div>
            {mode === 'append' && (
              <Select value={targetBatchId} onChange={(e) => setTargetBatchId(e.target.value)} className="mt-2">
                <option value="">{t('flashcard.selectDeckPlaceholder')}</option>
                {existingDecks.map(d => (
                  <option key={d.batch_id} value={d.batch_id}>
                    {d.title || t('flashcard.deckLabel', { date: d.latest ? formatDate(d.latest) : '?', count: d.count })}
                  </option>
                ))}
              </Select>
            )}
            <p className="text-3xs text-text-muted mt-1">{t('flashcard.deckModeHint')}</p>
          </div>
        )}
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
                    ? 'bg-primary-solid text-white border-primary-solid'
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
