import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from '@/icons';
import { useTranslation } from 'react-i18next';
import { subjectAPI } from '@/services/api';
import { extractErrorMessage } from '@/utils/errors';

export default function EditSubjectModal({ subject, onClose, onSuccess }) {
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
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err) || t('subjectDashboard.editError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
          <h3 className="font-bold text-text">{t('subjectDashboard.editTitle')}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">{t('subjectDashboard.editName')} *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">{t('subjectDashboard.editSemester')}</label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">{t('subjectDashboard.editLecturer')}</label>
              <input
                type="text"
                value={formData.lecturer}
                onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">{t('subjectDashboard.editDescription')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost text-sm px-4 py-2 border border-border">
              {t('common.cancel', 'Batal')}
            </button>
            <button type="submit" disabled={isSubmitting || !formData.name.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              {isSubmitting ? t('common.saving', 'Menyimpan...') : t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
