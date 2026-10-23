import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { materiAPI } from '@/services/api';
import { Tooltip } from '@/components/ui';
import { getMaterialStatusLabel } from '@/utils/status';

export default function MaterialPicker({
  subjectId,
  selectedMaterialIds,
  onSelectionChange,
  autoSelectReady = false,
}) {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const previousSubjectRef = useRef(subjectId);
  const autoSelectedForRef = useRef(null);

  // Saat mata kuliah berganti, buang pilihan lama agar ID materi tidak
  // tercampur antar-subject.
  useEffect(() => {
    if (previousSubjectRef.current !== subjectId) {
      previousSubjectRef.current = subjectId;
      autoSelectedForRef.current = null;
      onSelectionChange([]);
    }
  }, [subjectId, onSelectionChange]);

  useEffect(() => {
    if (!subjectId) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    setError('');
    materiAPI.getAll(subjectId)
      .then((res) => {
        const all = res.data?.materials || [];
        setMaterials(all);
      })
      .catch((err) => setError(err.message || t('materialPicker.errorLoad')))
      .finally(() => setLoading(false));
  }, [subjectId]);

  // Alur ujian: materi yang sudah siap dipilih otomatis supaya pengguna tidak
  // perlu mencentang satu per satu. Tetap bisa diubah manual setelahnya.
  useEffect(() => {
    if (!autoSelectReady || !subjectId || loading) return;
    const readyIds = materials.filter((m) => m.status === 'Ready').map((m) => String(m.id));
    if (!readyIds.length || autoSelectedForRef.current === subjectId) return;
    if (selectedMaterialIds.length > 0) return;
    autoSelectedForRef.current = subjectId;
    onSelectionChange(readyIds);
  }, [autoSelectReady, subjectId, loading, materials, selectedMaterialIds.length, onSelectionChange]);

  const toggle = (id) => {
    const next = selectedMaterialIds.includes(String(id))
      ? selectedMaterialIds.filter((k) => k !== String(id))
      : [...selectedMaterialIds, String(id)];
    onSelectionChange(next);
  };

  if (!subjectId) return null;

  if (loading) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-background border border-border">
        <p className="text-xs text-text-muted">{t('materialPicker.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20">
        <p className="text-xs text-danger">{error}</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-background border border-border">
        <p className="text-xs text-text-muted">{t('materialPicker.empty')}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-text-secondary">
          {t('materialPicker.sourceLabel')}
        </label>
        <button
          type="button"
          onClick={() => {
            if (selectedMaterialIds.length === materials.filter(m => m.status === 'Ready').length) {
              onSelectionChange([]);
            } else {
              onSelectionChange(materials.filter(m => m.status === 'Ready').map(m => String(m.id)));
            }
          }}
          className="text-3xs font-medium text-primary hover:text-primary-focus transition-colors"
        >
          {selectedMaterialIds.length > 0 ? t('materialPicker.cancelSelection') : t('materialPicker.selectAll')}
        </button>
      </div>
      <p className="text-3xs text-text-muted mb-2">{t('materialPicker.hint')}</p>
      <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl bg-background border border-border p-2">
        {materials.map((m) => {
          const isReady = m.status === 'Ready';
          const checked = selectedMaterialIds.includes(String(m.id));
          return (
            <Tooltip key={m.id} label={!isReady ? t('materialPicker.notReadyTitle', { status: getMaterialStatusLabel(t, m.status) }) : ''}>
              <label
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                  !isReady ? 'opacity-60 cursor-not-allowed bg-card/50' : 
                  checked ? 'bg-primary/10 cursor-pointer' : 'hover:bg-card cursor-pointer'
                }`}
              >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => isReady && toggle(m.id)}
                disabled={!isReady}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                  ${checked ? 'bg-primary-solid border-primary-solid' : 'bg-card border-border'}
                  peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50
                  peer-disabled:opacity-30 peer-disabled:cursor-not-allowed`}
              >
                <svg
                  viewBox="0 0 12 10"
                  className={`w-2.5 h-2.5 text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
                  fill="none"
                >
                  <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs text-text truncate">{m.filename}</span>
                {!isReady && (
                  <span className="text-2xs text-warning mt-0.5">{getMaterialStatusLabel(t, m.status)}</span>
                )}
              </div>
            </label>
            </Tooltip>
          );
        })}
      </div>
      {selectedMaterialIds.length > 0 && (
        <p className="text-3xs text-text-muted mt-1">
          {t('materialPicker.selectedCount', { count: selectedMaterialIds.length })}
        </p>
      )}
    </div>
  );
}