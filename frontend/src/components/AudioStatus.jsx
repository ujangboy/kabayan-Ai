import { useQuery } from '@tanstack/react-query';
import { Play, Trash2, X } from 'lucide-react';
import { audioAPI } from '@/services/api';

export default function AudioStatus({ materialId, onCancel, onDelete, onRetry }) {
  const { data } = useQuery({
    queryKey: ['audioStatus', materialId],
    queryFn: () => audioAPI.status(materialId).then((res) => res.data),
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 5000 : false),
    enabled: !!materialId,
    staleTime: 5000,
  });

  if (!data || data.status === 'none') {
    return null;
  }

  if (data.status === 'processing') {
    return (
      <div className="space-y-1 min-w-[130px]">
        <div className="flex items-center gap-2">
          <span className="badge badge-warning text-[10px]">Membuat audio...</span>
          <button
            onClick={() => { if (confirm('Batalkan pembuatan audio ini?')) onCancel(materialId); }}
            className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Batalkan"
          >
            <X size={12} />
          </button>
        </div>
        <div className="w-full h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent-teal transition-all duration-700" style={{ width: `${Math.max(data.progress || 0, 4)}%` }} />
        </div>
        <div className="text-[10px] text-text-muted leading-tight truncate max-w-[170px]" title={data.stage || 'Memproses...'}>
          {data.stage || 'Memproses...'}
        </div>
      </div>
    );
  }

  if (data.status === 'done') {
    return (
      <div className="space-y-2">
        <audio controls className="w-full rounded-xl bg-background" src={data.filepath} />
        <div className="flex items-center gap-2">
          <a href={data.filepath} download className="text-primary text-[11px] hover:underline inline-flex items-center gap-1">
            <Play size={12} /> Download audio
          </a>
          <button
            onClick={() => { if (confirm('Hapus audio podcast dari materi ini?')) onDelete(materialId); }}
            className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Hapus audio"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="badge badge-danger text-[10px]">Audio gagal</span>
      {data.failure_reason && (
        <div className="text-[10px] text-danger leading-tight max-w-[180px] break-words" title={data.failure_reason}>
          {data.failure_reason}
        </div>
      )}
      <button
        onClick={() => onRetry(materialId)}
        className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
      >
        <Play size={10} /> Coba lagi
      </button>
    </div>
  );
}
