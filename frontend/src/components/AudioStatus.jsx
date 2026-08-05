import { useQuery } from '@tanstack/react-query';
import { Play, Trash2, X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audioAPI } from '@/services/api';

export default function AudioStatus({ materialId, onCancel, onDelete, onRetry, onRegenerate }) {
  const { t } = useTranslation();
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
          <span className="badge badge-warning text-[10px]">{t('audioStatus.processing')}</span>
          <button
            onClick={() => { if (confirm(t('audioStatus.cancelConfirm'))) onCancel(materialId); }}
            className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title={t('audioStatus.cancelTitle')}
          >
            <X size={12} />
          </button>
        </div>
        <div className="w-full h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent-teal transition-all duration-700" style={{ width: `${Math.max(data.progress || 0, 4)}%` }} />
        </div>
        <div className="text-[10px] text-text-muted leading-tight truncate max-w-[170px]" title={data.stage || t('audioStatus.processingFallback')}>
          {data.stage || t('audioStatus.processingFallback')}
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
            <Play size={12} /> {t('audioStatus.download')}
          </a>
          <button
            onClick={() => { if (confirm(t('audioStatus.regenerateConfirm'))) onRegenerate(materialId); }}
            className="p-0.5 rounded text-text-muted hover:text-accent-teal hover:bg-accent-teal/10 transition-colors"
            title={t('audioStatus.regenerateTitle')}
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => { if (confirm(t('audioStatus.deleteConfirm'))) onDelete(materialId); }}
            className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title={t('audioStatus.deleteTitle')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="badge badge-danger text-[10px]">{t('audioStatus.failed')}</span>
      {data.failure_reason && (
        <div className="text-[10px] text-danger leading-tight max-w-[180px] break-words" title={data.failure_reason}>
          {data.failure_reason}
        </div>
      )}
      <button
        onClick={() => onRetry(materialId)}
        className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
      >
        <Play size={10} /> {t('audioStatus.retry')}
      </button>
    </div>
  );
}
