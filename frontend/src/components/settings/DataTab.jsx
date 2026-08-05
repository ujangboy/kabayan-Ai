import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, FileText, MessageSquare, BookMarked, CreditCard,
  HelpCircle, Brain, LayoutTemplate, Database as DatabaseIcon, HardDrive,
  Trash2, Loader2, RotateCcw, Trash as TrashIcon, XCircle,
} from 'lucide-react';
import { dataAPI, materiAPI, trashAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/utils';
import { cn } from '@/utils';

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const STATUS_BADGE = {
  Ready: 'bg-success/15 text-success border-success/30',
  Processing: 'bg-warning/15 text-warning border-warning/30',
  Pending: 'bg-warning/15 text-warning border-warning/30',
  Failed: 'bg-danger/15 text-danger border-danger/30',
};

export default function DataTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['data-overview'],
    queryFn: () => dataAPI.overview().then((r) => r.data),
  });

  const { data: materialData } = useQuery({
    queryKey: ['materials', 'all'],
    queryFn: () => materiAPI.getAll().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => materiAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['materials', 'all']);
      queryClient.invalidateQueries(['data-overview']);
      queryClient.invalidateQueries(['trash']);
      toast.success(t('settings.data.deleted'));
    },
    onError: () => toast.error(t('settings.data.deleteError')),
  });

  const handleDelete = (m) => {
    if (window.confirm(t('settings.data.deleteConfirm').replace('{name}', m.filename || `#${m.id}`))) {
      deleteMutation.mutate(m.id);
    }
  };

  const { data: trashData } = useQuery({
    queryKey: ['trash'],
    queryFn: () => trashAPI.list().then((r) => r.data),
  });

  const restoreMutation = useMutation({
    mutationFn: (item) => (item.material_id ? trashAPI.restoreMaterial(item.material_id) : trashAPI.restore(item.id)),
    onSuccess: () => {
      queryClient.invalidateQueries(['trash']);
      queryClient.invalidateQueries(['materials', 'all']);
      queryClient.invalidateQueries(['data-overview']);
      toast.success(t('settings.data.trashRestored'));
    },
    onError: () => toast.error(t('settings.data.trashError')),
  });

  const deleteTrashMutation = useMutation({
    mutationFn: (item) => (item.material_id ? trashAPI.deleteMaterial(item.material_id) : trashAPI.delete(item.id)),
    onSuccess: () => {
      queryClient.invalidateQueries(['trash']);
      queryClient.invalidateQueries(['data-overview']);
      toast.success(t('settings.data.trashDeleted'));
    },
    onError: () => toast.error(t('settings.data.trashError')),
  });

  const emptyTrashMutation = useMutation({
    mutationFn: () => trashAPI.empty(),
    onSuccess: () => {
      queryClient.invalidateQueries(['trash']);
      queryClient.invalidateQueries(['data-overview']);
      toast.success(t('settings.data.trashEmptied'));
    },
    onError: () => toast.error(t('settings.data.trashError')),
  });

  const handleRestore = (item) => {
    restoreMutation.mutate(item);
  };

  const handleDeleteTrash = (item) => {
    const name = item.original_filename || `#${item.id}`;
    if (window.confirm(t('settings.data.trashDeleteConfirm').replace('{name}', name))) {
      deleteTrashMutation.mutate(item);
    }
  };

  const handleEmptyTrash = () => {
    if (window.confirm(t('settings.data.trashEmptyConfirm'))) {
      emptyTrashMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const stats = overview?.stats || {};
  const storage = overview?.storage || {};
  const materials = materialData?.materials || [];

  const CATEGORIES = [
    { key: 'subjects', label: t('settings.data.subjects'), icon: BookOpen },
    { key: 'materials', label: t('settings.data.materials'), icon: FileText },
    { key: 'chats', label: t('settings.data.chats'), icon: MessageSquare },
    { key: 'messages', label: t('settings.data.messages'), icon: MessageSquare },
    { key: 'notes', label: t('settings.data.notes'), icon: BookMarked },
    { key: 'flashcards', label: t('settings.data.flashcards'), icon: CreditCard },
    { key: 'quizzes', label: t('settings.data.quizzes'), icon: HelpCircle },
    { key: 'examSessions', label: t('settings.data.examSessions'), icon: Brain },
    { key: 'examBlueprints', label: t('settings.data.examBlueprints'), icon: LayoutTemplate },
    { key: 'questionBank', label: t('settings.data.questionBank'), icon: DatabaseIcon },
  ];

  const STORAGE_ROWS = [
    { label: t('settings.data.storageUploads'), value: storage.uploads },
    { label: t('settings.data.storageAudio'), value: storage.audio },
    { label: t('settings.data.storageTrash'), value: storage.trash },
  ];

  const mapKey = {
    subjects: 'subjects', materials: 'materials', chats: 'chats',
    messages: 'messages', notes: 'notes', flashcards: 'flashcards',
    quizzes: 'quizzes', examSessions: 'exam_sessions',
    examBlueprints: 'exam_blueprints', questionBank: 'question_bank',
  };

  return (
    <div className="space-y-6">
      {/* Count cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <div key={key} className="card-base p-4 flex flex-col gap-1">
            <Icon size={16} className="text-primary" />
            <span className="text-xl font-bold text-text">{stats[mapKey[key]] ?? 0}</span>
            <span className="text-xs text-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Material status */}
      <div className="card-base p-5">
        <h3 className="text-sm font-semibold text-text mb-3">{t('settings.data.materials')}</h3>
        <div className="flex gap-6 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            {t('settings.data.materialsReady')} <b className="text-text">{stats.materials_ready ?? 0}</b>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning inline-block" />
            {t('settings.data.materialsPending')} <b className="text-text">{stats.materials_pending ?? 0}</b>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger inline-block" />
            {t('settings.data.materialsFailed')} <b className="text-text">{stats.materials_failed ?? 0}</b>
          </span>
        </div>
      </div>

      {/* Materials list */}
      <div className="card-base p-5">
        <h3 className="text-sm font-semibold text-text mb-3">
          {t('settings.data.materials')} ({materials.length} {t('settings.data.items')})
        </h3>
        {materials.length === 0 ? (
          <p className="text-text-muted text-sm">{t('settings.data.noMaterials')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materials')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materialSubject')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materialType')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materialStatus')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materialSize')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.materialUploaded')}</th>
                  <th className="py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text max-w-[220px] truncate" title={m.filename}>
                      {m.filename}
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{m.subject?.name || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{m.material_type || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-medium',
                        STATUS_BADGE[m.status] || 'bg-card border-border text-text-secondary')}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{formatBytes(m.size_bytes)}</td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {m.upload_date ? formatDate(m.upload_date) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDelete(m)}
                        disabled={deleteMutation.isPending}
                        title={t('common.delete')}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        {deleteMutation.isPending && deleteMutation.variables === m.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trash (Sampah) */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <TrashIcon size={15} className="text-danger" />
            {t('settings.data.trash')} ({trashData?.items?.length || 0})
          </h3>
          {(trashData?.items?.length || 0) > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={emptyTrashMutation.isPending}
              className="text-xs text-text-muted hover:text-danger transition-colors"
            >
              {emptyTrashMutation.isPending ? <Loader2 size={13} className="animate-spin inline" /> : t('settings.data.trashEmpty')}
            </button>
          )}
        </div>

        {(trashData?.items?.length || 0) === 0 ? (
          <p className="text-text-muted text-sm">{t('settings.data.noTrash')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashName')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashOrigin')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashSize')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashDate')}</th>
                  <th className="py-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {trashData.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text max-w-[220px] truncate" title={item.original_filename}>
                      {item.original_filename}
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">
                      <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-medium',
                        item.material_id ? 'bg-warning/15 text-warning border-warning/30' : 'bg-card border-border text-text-secondary')}>
                        {item.material_id ? t('settings.data.trashFromMaterial') : t('settings.data.trashOrphan')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{formatBytes(item.size_bytes)}</td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {item.trashed_at ? formatDate(item.trashed_at) : '—'}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={restoreMutation.isPending}
                        title={t('settings.data.trashRestore')}
                        className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors mr-1"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTrash(item)}
                        disabled={deleteTrashMutation.isPending}
                        title={t('settings.data.trashDeleteForever')}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage */}
      <div className="card-base p-5">
        <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
          <HardDrive size={15} className="text-primary" />
          {t('settings.data.storage')}
        </h3>
        <div className="space-y-2">
          {STORAGE_ROWS.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text">{formatBytes(value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs border-t border-border pt-2 mt-2">
            <span className="font-semibold text-text">{t('common.all')}</span>
            <span className="font-bold text-text">{formatBytes(storage.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}