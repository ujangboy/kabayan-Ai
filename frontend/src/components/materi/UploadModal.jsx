import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';

import { materiAPI } from '@/services/api';
import { Modal, Button, Select, Input , Icon } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import { useToast } from '@/components/Toast';

const MAX_SIZE = 50 * 1024 * 1024; // selaras dengan batas backend (50MB)

export function UploadModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const processOp = usePendingOperation('process');
  const [files, setFiles] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFilesChange = (fileList) => {
    const list = Array.from(fileList || []);
    const tooBig = list.find((f) => f.size > MAX_SIZE);
    if (tooBig) {
      toast.error(t('materi.uploadFileTooLarge', { name: tooBig.name, limit: '50MB' }));
    }
    const valid = list.filter((f) => f.size <= MAX_SIZE);
    setFiles(valid);
    setError('');
    // Reset input agar file yang sama bisa dipilih ulang setelah gagal.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetState = () => {
    setFiles([]);
    setSubjectId('');
    setIsSubmitting(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !subjectId) return setError(t('materi.uploadSelectFileSubject'));
    setError('');
    setIsSubmitting(true);
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('subject_id', subjectId);
    try {
      const res = await materiAPI.upload(formData);
      if (res.data?.detail) throw new Error(res.data.detail);
      const ids = res.data?.material_ids || (res.data?.material_id ? [res.data.material_id] : []);
      ids.forEach((mid) => processOp.start(`process-${mid}`));
      toast.success(t('materi.uploadSuccess', { count: ids.length }));
      resetState();
      onSuccess?.(res.data);
    } catch (err) {
      setError(extractErrorMessage(err) || t('materi.uploadFailedRetry'));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!isSubmitting) onClose(); }}
      title={t('materi.uploadModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="upload-form" loading={isSubmitting} disabled={files.length === 0}>{t('materi.uploadAndProcess')}</Button>
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
            title={subjects.find((s) => String(s.id) === String(subjectId))?.name || ''}
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
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
              <Icon name={ICONS.actions.upload} size={24} className="text-primary-light" />
            </div>
            {files.length === 0 ? (
              <>
                <p className="text-base font-medium text-text">{t('materi.uploadDropzone')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('materi.uploadMaxSize')}</p>
                <p className="mt-1 text-xs text-primary-light">{t('materi.uploadMultipleHint')}</p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-text">
                  {files.length === 1 ? files[0].name : t('materi.uploadMultipleFiles', { count: files.length })}
                </p>
                {files.length > 1 && (
                  <div className="mt-2 max-h-24 w-full overflow-y-auto text-left">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-text-secondary py-0.5">
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-text-muted">{Math.round(f.size / 1024)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                  className="mt-2 text-xs text-text-muted hover:text-danger transition-colors"
                >
                  {t('materi.uploadClearSelection')}
                </button>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFilesChange(e.target.files)}
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv,.pptx,.xlsx"
              multiple
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
