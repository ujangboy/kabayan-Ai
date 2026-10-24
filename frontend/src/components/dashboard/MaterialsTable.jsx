import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';

import { useTranslation } from 'react-i18next';
import { materiAPI } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/utils/errors';
import { formatDate } from '@/utils';
import { getMaterialStatusLabel } from '@/utils/status';
import FileTypeIcon from '@/components/FileTypeIcon';
import { useToast } from '@/components/Toast';
import { Tooltip, ConfirmDialog , Icon } from '@/components/ui';

export default function MaterialsTable({ materials, subjectId, compact = false }) {
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
      queryClient.invalidateQueries(['materials']);
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

  const rowPy = compact ? 'py-2' : 'py-2.5';
  const headerPy = 'py-2';

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Header — title + search + add */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2.5 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <Icon name={ICONS.files.document} size={13} className="text-text-secondary" />
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('subjectDashboard.materialsTitle', { count: allMaterials.length })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name={ICONS.actions.search} size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('subjectDashboard.searchMaterials', 'Cari materi...')}
                className="w-36 sm:w-44 bg-subtle border border-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-text placeholder:text-text-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={() => navigate(`/materi?subject_id=${subjectId}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-solid text-white hover:bg-primary-solid-hover transition-colors"
            >
              <Icon name={ICONS.actions.addOutline} size={12} /> {t('subjectDashboard.addMaterial', 'Tambah')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-2xs text-text-secondary uppercase tracking-wider border-b border-border bg-base/50">
              <th className={`px-3 ${headerPy} text-left font-medium`}>#</th>
              <th className={`px-3 ${headerPy} text-left font-medium`}>{t('subjectDashboard.materialName', 'Nama')}</th>
              <th className={`px-3 ${headerPy} text-left font-medium`}>{t('subjectDashboard.materialType', 'Tipe')}</th>
              <th className={`px-3 ${headerPy} text-right font-medium`}>{t('subjectDashboard.materialStatus', 'Status')}</th>
              <th className={`px-3 ${headerPy} text-left font-medium`}>{t('subjectDashboard.materialDate', 'Tanggal')}</th>
              <th className={`px-3 ${headerPy} text-right font-medium`}>{t('subjectDashboard.materialActions', 'Aksi')}</th>
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
                <tr
                  key={m.id}
                  onClick={() => navigate(`/materi?subject_id=${subjectId}&highlight=${m.id}`)}
                  className="border-b border-border last:border-0 hover:bg-subtle transition-colors cursor-pointer"
                >
                  <td className={`px-3 ${rowPy} text-text-secondary text-xs w-8`}>{idx + 1}</td>
                  <td className={`px-3 ${rowPy}`}>
                    <div className="flex items-center gap-2.5">
                      <FileTypeIcon type={(m.filename || '').split('.').pop()?.toUpperCase() || m.material_type} className="text-base text-text-secondary" />
                      <Tooltip label={m.filename}>
                        <span className="text-sm text-text font-medium truncate max-w-[220px]">{m.filename}</span>
                      </Tooltip>
                    </div>
                  </td>
                  <td className={`px-3 ${rowPy} text-text-secondary text-xs`}>{(m.filename || '').split('.').pop()?.toUpperCase() || m.material_type}</td>
                  <td className={`px-3 ${rowPy} text-right`}>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-medium border ${m.status === 'Ready' ? 'bg-success/10 text-success border-success/20' : m.status === 'Failed' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                      {getMaterialStatusLabel(t, m.status)}
                    </span>
                  </td>
                  <td className={`px-3 ${rowPy} text-text-secondary text-xs whitespace-nowrap`}>{formatDate(m.upload_date)}</td>
                  <td className={`px-3 ${rowPy} text-right`}>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip label={t('subjectDashboard.viewMaterial', 'Lihat')}>
                        <button
                          onClick={() => navigate(`/materi?subject_id=${subjectId}&highlight=${m.id}`)}
                          aria-label={t('subjectDashboard.viewMaterial', 'Lihat')}
                          className="p-1 rounded-md text-text-secondary hover:text-primary-light hover:bg-primary/10 transition-colors"
                        >
                          <Icon name={ICONS.ui.eye} size={12} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('subjectDashboard.quizMaterial', 'Quiz dari materi ini')}>
                        <button
                          onClick={() => navigate(`/quiz?subject_id=${subjectId}`)}
                          aria-label={t('subjectDashboard.quizMaterial', 'Quiz dari materi ini')}
                          className="p-1 rounded-md text-text-secondary hover:text-info hover:bg-info/10 transition-colors"
                        >
                          <Icon name={ICONS.ui.help} size={12} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('subjectDashboard.deleteMaterial', 'Hapus')}>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          aria-label={t('subjectDashboard.deleteMaterial', 'Hapus')}
                          className="p-1 rounded-md text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Icon name={ICONS.actions.delete} size={12} />
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