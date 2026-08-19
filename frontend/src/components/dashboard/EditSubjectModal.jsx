import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subjectAPI } from '@/services/api';
import { extractErrorMessage } from '@/utils/errors';
import { Modal, Button, Input, Textarea } from '@/components/ui';

export default function EditSubjectModal({ subject, open, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: subject?.name || '',
    semester: subject?.semester || '',
    lecturer: subject?.lecturer || '',
    description: subject?.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await subjectAPI.update(subject.id, formData);
      onSuccess?.();
    } catch (err) {
      setError(extractErrorMessage(err) || t('subjectDashboard.editError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subjectDashboard.editTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Batal')}
          </Button>
          <Button type="submit" form="edit-subject-form" loading={isSubmitting} disabled={!formData.name.trim()}>
            {t('common.save', 'Simpan')}
          </Button>
        </>
      }
    >
      <form id="edit-subject-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">
            {t('subjectDashboard.editName')} *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              {t('subjectDashboard.editSemester')}
            </label>
            <Input
              type="text"
              value={formData.semester}
              onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              {t('subjectDashboard.editLecturer')}
            </label>
            <Input
              type="text"
              value={formData.lecturer}
              onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary">
            {t('subjectDashboard.editDescription')}
          </label>
          <Textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
