import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { subjectAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { Modal, Button, Input, Textarea } from '@/components/ui';

/**
 * Modal tambah mata kuliah yang dipakai bersama oleh halaman Mata Kuliah dan
 * Ujian Simulasi. `onSuccess` menerima objek subject dari API (id + name) agar
 * pemanggil bisa langsung memilih mata kuliah yang baru dibuat.
 */
export default function CreateSubjectModal({ open, onClose, onSuccess }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', semester: '', lecturer: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await subjectAPI.create(formData);
      if (res.data?.detail) throw new Error(res.data.detail);
      setFormData({ name: '', semester: '', lecturer: '', description: '' });
      onSuccess?.(res.data?.subject || null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subjects.addNew')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="create-subject-form" loading={isSubmitting} disabled={!formData.name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="create-subject-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formNameLabel')}</label>
          <Input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder={t('subjects.formNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formSemesterLabel')}</label>
            <Input
              type="text"
              value={formData.semester}
              onChange={(e) => setFormData((p) => ({ ...p, semester: e.target.value }))}
              placeholder={t('subjects.formSemesterPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formLecturerLabel')}</label>
            <Input
              type="text"
              value={formData.lecturer}
              onChange={(e) => setFormData((p) => ({ ...p, lecturer: e.target.value }))}
              placeholder={t('subjects.formLecturerPlaceholder')}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('subjects.formNotesLabel')}</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            placeholder={t('subjects.formNotesPlaceholder')}
          />
        </div>
      </form>
    </Modal>
  );
}
