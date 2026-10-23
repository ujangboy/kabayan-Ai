import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { motion } from 'framer-motion';

import { notesAPI } from '@/services/api';
import { Select , Icon } from '@/components/ui';
import MaterialPicker from '@/components/MaterialPicker';
import { useBackgroundJob } from '@/hooks/useBackgroundJob';
import { useJobStore } from '@/store/jobStore';
import { cn } from '@/utils';

// Key job global — hasil tetap tersimpan walau panel/halaman unmount.
const JOB_KEY = 'notebook-generate';

export function GeneratePanel({ subjects, onClose, onNoteCreated }) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  // isGenerating diambil dari jobStore agar state "AI menulis" bertahan
  // saat panel ditutup & dibuka lagi saat job masih berjalan.
  const { run: runJob } = useBackgroundJob();
  const isGenerating = useJobStore((s) => Boolean(s.jobs[JOB_KEY]));
  const carriedResult = useJobStore((s) => s.results[JOB_KEY]);

  const handleGenerate = () => {
    if (!subjectId) { setError(t('notebook.selectSubjectError')); return; }
    if (selectedMaterialIds.length === 0) { setError(t('notebook.selectMaterialError')); return; }

    setError('');
    const subjectToUse = Number(subjectId);
    const chosenTopic = topic;
    runJob(
      JOB_KEY,
      t('notebook.generateJobLabel'),
      async (signal) => {
        const payload = {
          subject_id: subjectToUse,
          material_ids: selectedMaterialIds.join(','),
        };
        // Topic is sent as context for AI, NOT as the note title
        if (chosenTopic.trim()) payload.title = chosenTopic.trim().slice(0, 80);

        const res = await notesAPI.generate(payload, { signal });
        const result = res.data;

        // Title comes from AI-generated content (extracted by backend)
        const noteTitle = result.title || t('notebook.aiNoteTitle');

        // Save the generated note to DB
        const saveRes = await notesAPI.create(noteTitle, result.content || '', subjectToUse, { signal });
        const noteId = saveRes.data?.note_id;

        if (!noteId) throw new Error(t('notebook.generateLoadError'));

        // Fetch full note object and return it for the consumer
        const listRes = await notesAPI.getAll();
        const allNotes = listRes.data?.notes || [];
        const newNote = allNotes.find((n) => n.id === noteId);
        if (newNote) return newNote;
        // Fallback: construct note from what we have
        return {
          id: noteId,
          title: result.title || chosenTopic.trim() || t('notebook.aiNoteTitle'),
          content: result.content || '',
          created_at: new Date().toISOString(),
          is_pinned: false,
          subject: subjects.find((s) => s.id === subjectToUse) || null,
        };
      },
      {
        storeResult: true,
        onError: (e) => setError(e.message || t('notebook.generateError')),
        onDone: (note) => onNoteCreated(note),
      }
    ).catch(() => { /* sudah ditampilkan sebagai error/toast */ });
  };

  // Job selesai saat panel unmount (user menutup panel/pindah menu):
  // terapkan hasil saat panel dibuka lagi di halaman Notebook.
  useEffect(() => {
    if (!carriedResult) return;
    const entry = useJobStore.getState().takeResult(JOB_KEY);
    if (!entry || entry.status !== 'success' || entry.result == null) return;
    onNoteCreated(entry.result);
  }, [carriedResult, onNoteCreated]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md glass border-l border-border shadow-modal flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 divider-gradient-b relative shrink-0">
          <div className="flex items-center gap-2">
            <Icon name={ICONS.learning.sparkles} size={18} className="text-primary" />
            <h3 className="font-semibold text-text text-base">{t('notebook.generateWithAi')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card transition-colors"
          >
            <Icon name={ICONS.actions.close} size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Subject selector */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {t('notebook.subjectLabel')}
            </label>
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setSelectedMaterialIds([]);
                setError('');
              }}
              className="w-full"
              title={subjects.find((s) => String(s.id) === String(subjectId))?.name || ''}
            >
              <option value="">{t('notebook.selectSubjectPlaceholder')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          {/* Material picker */}
          {subjectId && (
            <MaterialPicker
              subjectId={Number(subjectId)}
              selectedMaterialIds={selectedMaterialIds}
              onSelectionChange={setSelectedMaterialIds}
            />
          )}

          {/* Topic input */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {t('notebook.topicLabel')} <span className="text-text-muted font-normal">{t('notebook.topicOptionalHint')}</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('notebook.topicPlaceholder')}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
              onKeyDown={(e) => { if (e.key === 'Enter' && !isGenerating) handleGenerate(); }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-danger bg-danger/5 px-3 py-2 rounded-xl">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !subjectId || selectedMaterialIds.length === 0}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              'bg-primary-solid text-white hover:bg-primary-solid/90 shadow-sm',
              (isGenerating || !subjectId || selectedMaterialIds.length === 0) && 'opacity-50 pointer-events-none'
            )}
          >
            {isGenerating ? (
              <>
                <Icon name={ICONS.actions.refresh} size={14} className="animate-spin" />
                {t('notebook.aiWriting')}
              </>
            ) : (
              <>
                <Icon name={ICONS.learning.sparkles} size={15} />
                {t('notebook.generateNote')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}