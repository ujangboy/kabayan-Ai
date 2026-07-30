import { useState, useEffect } from 'react';
import { materiAPI } from '@/services/api';

export default function MaterialPicker({ subjectId, selectedMaterialIds, onSelectionChange }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subjectId) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    setError('');
    materiAPI.getAll()
      .then((res) => {
        const all = res.data?.materials || [];
        setMaterials(all.filter((m) => m.subject?.id === Number(subjectId)));
      })
      .catch((err) => setError(err.message || 'Gagal memuat materi'))
      .finally(() => setLoading(false));
  }, [subjectId]);

  const toggle = (id) => {
    const key = `mat_${id}`;
    const next = selectedMaterialIds.includes(key)
      ? selectedMaterialIds.filter((k) => k !== key)
      : [...selectedMaterialIds, key];
    onSelectionChange(next);
  };

  if (!subjectId) return null;

  if (loading) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-background border border-border">
        <p className="text-xs text-text-muted">Memuat daftar materi...</p>
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
        <p className="text-xs text-text-muted">Tidak ada materi untuk mata kuliah ini.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        Pilih Materi Spesifik (opsional — kosong = pakai semua)
      </label>
      <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl bg-background border border-border p-2">
        {materials.map((m) => {
          const isReady = m.status === 'Ready';
          const checked = selectedMaterialIds.includes(`mat_${m.id}`);
          return (
            <label
              key={m.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                !isReady ? 'opacity-60 cursor-not-allowed bg-card/50' : 
                checked ? 'bg-primary/10 cursor-pointer' : 'hover:bg-card cursor-pointer'
              }`}
              title={!isReady ? `Materi ini masih ${m.status}` : ''}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => isReady && toggle(m.id)}
                disabled={!isReady}
                className="h-4 w-4 rounded appearance-none cursor-pointer
                  bg-slate-800 border-2 border-slate-500
                  checked:bg-primary checked:border-primary
                  focus:outline-none focus:ring-2 focus:ring-primary/50
                  disabled:opacity-30 disabled:cursor-not-allowed
                  transition-colors shrink-0"
              />
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs text-text truncate">{m.filename}</span>
                {!isReady && (
                  <span className="text-[9px] text-warning mt-0.5">{m.status}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {selectedMaterialIds.length > 0 && (
        <p className="text-[10px] text-text-muted mt-1">
          {selectedMaterialIds.length} materi dipilih
        </p>
      )}
    </div>
  );
}