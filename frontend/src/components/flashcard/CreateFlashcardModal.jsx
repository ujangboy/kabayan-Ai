import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { extractErrorMessage } from '@/utils/errors';
import { Select, Textarea, Modal, Button , Icon } from '@/components/ui';

export default function CreateFlashcardModal({ open, subjects, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ question: '', answer: '', subject_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.question || !formData.answer || !formData.subject_id) {
      return setError(t('flashcard.fillAllFields'));
    }
    setIsSubmitting(true);
    const data = new URLSearchParams();
    data.append('question', formData.question);
    data.append('answer', formData.answer);
    data.append('subject_id', formData.subject_id);
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      if (!res.ok) throw new Error(t('flashcard.saveFailed'));
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={<span className="flex items-center gap-2"><Icon name={ICONS.nav.flashcard} size={18} className="text-primary" />{t('flashcard.manualModalTitle')}</span>}
      description={t('flashcard.manualModalDesc')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="create-flashcard-form" loading={isSubmitting} disabled={!formData.question}>{t('common.save')}</Button>
        </>
      }
    >
      <form id="create-flashcard-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('flashcard.subjectLabel')}</label>
          <Select
            value={formData.subject_id}
            onChange={(e) => setFormData(p => ({ ...p, subject_id: e.target.value }))}
          >
            <option value="">{t('flashcard.selectSubjectPlaceholder')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('flashcard.questionFrontLabel')}</label>
          <Textarea
            rows={2}
            placeholder={t('flashcard.questionPlaceholder')}
            value={formData.question}
            onChange={(e) => setFormData(p => ({ ...p, question: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('flashcard.answerBackLabel')}</label>
          <Textarea
            rows={3}
            placeholder={t('flashcard.answerPlaceholder')}
            value={formData.answer}
            onChange={(e) => setFormData(p => ({ ...p, answer: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  );
}