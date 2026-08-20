import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from '@/icons';
import { materiAPI } from '@/services/api';
import { Modal, Button, Select, Input } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';

export function UploadModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !subjectId) return setError(t('materi.uploadSelectFileSubject'));
    setError('');
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', subjectId);
    try {
      const res = await materiAPI.upload(formData);
      if (res.data?.detail) throw new Error(res.data.detail);
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err) || t('materi.uploadFailedRetry'));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('materi.uploadModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="upload-form" loading={isSubmitting} disabled={!file}>{t('materi.uploadAndProcess')}</Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={handleSubmit} className="space-y-4 p-5">
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
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('materi.uploadSelectFileLabel')}</label>
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary/15">
              <Upload size={24} className="text-primary-light" />
            </div>
            <p className="text-sm font-medium text-text">{file ? file.name : t('materi.uploadDropzone')}</p>
            <p className="mt-1 text-xs text-text-muted">{t('materi.uploadMaxSize')}</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv,.pptx,.xlsx"
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
