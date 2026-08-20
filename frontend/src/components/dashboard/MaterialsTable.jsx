import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';

import { useTranslation } from 'react-i18next';
import { materiAPI } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/utils/errors';
import { formatDate } from '@/utils';
import FileTypeIcon from '@/components/FileTypeIcon';
import { useToast } from '@/components/Toast';
import { Tooltip, ConfirmDialog , Icon } from '@/components/ui';

export default function MaterialsTable({ materials, subjectId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await materiAPI.delete(deleteTarget.id);
      toast.success(t('subjectDashboard.materialDeleted', 'Materi berhasil dihapus'));
      queryClient.invalidateQueries(['subject-dashboard', subjectId]);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractErrorMessage(err) || t('subjectDashboard.deleteMaterialError', 'Gagal menghapus materi'));
    } finally {
      setIsDeleting(false);
    }
  };

  const allMaterials = materials || [];
  const filtered = query.trim()
    ? allMaterials.filter((m) => (m.filename || '').toLowerCase().includes(query.trim().toLowerCase()))
    : allMaterials;

  return (
    <>
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl overflow-x-auto">
        {/* Header — title + search + add */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 divider-gradient-b relative">
          <div className="flex items-center gap-2">
            <Icon name={ICONS.files.document} size={14} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              {t('subjectDashboard.materialsTitle', { count: allMaterials.length })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name={ICONS.actions.search} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('subjectDashboard.searchMaterials', 'Cari materi...')}
                className="w-40 sm:w-48 bg-white/[0.03] border border-white/[0.08] rounded-lg pl-7 pr-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>
            <button
              onClick={() => navigate(`/materi?subject_id=${subjectId}`)}
              className="btn-primary px-3 py-1.5 rounded-lg text-xs"
            >
              <Icon name={ICONS.actions.addOutline} size={12} /> {t('subjectDashboard.addMaterial', 'Tambah')}
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="tr-divider text-[10px] text-text-muted uppercase tracking-wider">
              <th className="px-4 py-2 text-left font-semibold">#</th>
              <th className="px-4 py-2 text-left font-semibold">{t('subjectDashboard.materialName', 'Nama')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('subjectDashboard.materialType', 'Tipe')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('subjectDashboard.materialStatus', 'Status')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('subjectDashboard.materialDate', 'Tanggal')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('subjectDashboard.materialActions', 'Aksi')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10">
                  <p className="text-sm text-text-muted">
                    {allMaterials.length === 0
                      ? t('subjectDashboard.materialsEmpty')
                      : t('subjectDashboard.materialsNoMatch', 'Tidak ada materi yang cocok')}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((m, idx) => (
                <tr key={m.id} className="tr-divider last:border-0 hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3 text-text-muted text-xs w-8">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileTypeIcon type={(m.filename || '').split('.').pop()?.toUpperCase() || m.material_type} className="text-lg text-text-muted" />
                      <span className="text-text font-medium truncate max-w-[220px]" title={m.filename}>{m.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{(m.filename || '').split('.').pop()?.toUpperCase() || m.material_type}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`badge text-[10px] ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{formatDate(m.upload_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip label={t('subjectDashboard.viewMaterial', 'Lihat')}>
                        <button
                          onClick={() => navigate('/materi')}
                          aria-label={t('subjectDashboard.viewMaterial', 'Lihat')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-colors"
                        >
                          <Icon name={ICONS.ui.eye} size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('subjectDashboard.quizMaterial', 'Quiz dari materi ini')}>
                        <button
                          onClick={() => navigate(`/quiz?subject_id=${subjectId}`)}
                          aria-label={t('subjectDashboard.quizMaterial', 'Quiz dari materi ini')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent-teal hover:bg-accent-teal/10 transition-colors"
                        >
                          <Icon name={ICONS.ui.help} size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('subjectDashboard.deleteMaterial', 'Hapus')}>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          aria-label={t('subjectDashboard.deleteMaterial', 'Hapus')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Icon name={ICONS.actions.delete} size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('subjectDashboard.deleteMaterialTitle', 'Hapus Materi')}
        message={t('subjectDashboard.deleteMaterialConfirm', { name: deleteTarget?.filename })}
        loading={isDeleting}
      />
    </>
  );
}