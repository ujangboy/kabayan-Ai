import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { materiAPI } from '@/services/api';
import { Modal, Button, Select, Input } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';

export function YoutubeModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url || !subjectId) return setError(t('materi.youtubeEnterUrlSubject'));
    setError('');
    setIsSubmitting(true);
    try {
      const res = await materiAPI.importYoutube({ url, subject_id: parseInt(subjectId) });
      if (res.data?.detail) throw new Error(res.data.detail);
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
      title={t('materi.youtubeModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button variant="danger" type="submit" form="youtube-form" loading={isSubmitting} disabled={!url}>{t('materi.importTranscript')}</Button>
        </>
      }
    >
      <form id="youtube-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('materi.subjectLabel')}</label>
          <Select
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">{t('materi.selectSubject')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
          />
          <p className="mt-1 text-3xs text-text-muted">
            {t('materi.youtubeSubtitleInfo')}
            <br />
            {t('materi.youtubeSubtitleHelp')}
          </p>
        </div>
      </form>
    </Modal>
  );
}