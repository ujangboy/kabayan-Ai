import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';

import { dataAPI, materiAPI, trashAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { formatDate, formatBytes } from '@/utils';
import { cn } from '@/utils';
import { Tooltip } from '@/components/ui/Tooltip';

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
  const navigate = useNavigate();

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
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['data-overview'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast.success(t('settings.data.deleted'));
    },
    onError: () => toast.error(t('settings.data.deleteError')),
  });

  const handleDelete = (m) => {
    toast.confirm({
      title: t('settings.data.deleteConfirm').replace('{name}', m.filename || `#${m.id}`),
      message: t('settings.data.deleteConfirm').replace('{name}', m.filename || `#${m.id}`),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(m.id),
    });
  };

  const { data: trashData } = useQuery({
    queryKey: ['trash'],
    queryFn: () => trashAPI.list().then((r) => r.data),
  });

  const restoreMutation = useMutation({
    mutationFn: (item) => (item.material_id ? trashAPI.restoreMaterial(item.material_id) : trashAPI.restore(item.id)),
    onSuccess: (res, item) => {
      const payload = res?.data || {};
      const mid = item.material_id ?? item.id;
      const sid = payload.subject_id ?? materialData?.materials?.find(m => m.id === mid)?.subject_id;
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['data-overview'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['subject-dashboard'] });
      toast.success(t('settings.data.trashRestored'));
      if (sid) navigate(`/materi?subject_id=${sid}&highlight=${mid}`);
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
    toast.confirm({
      title: t('settings.data.trashDeleteConfirm').replace('{name}', name),
      message: t('settings.data.trashDeleteConfirm').replace('{name}', name),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteTrashMutation.mutate(item),
    });
  };

  const handleEmptyTrash = () => {
    toast.confirm({
      title: t('settings.data.trashEmptyConfirm'),
      message: t('settings.data.trashEmptyConfirm'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => emptyTrashMutation.mutate(),
    });
  };

  const { data: backups } = useQuery({
    queryKey: ['backups'],
    queryFn: () => dataAPI.listBackups(),
  });

  const backupMutation = useMutation({
    mutationFn: () => dataAPI.createBackup(),
    onSuccess: async (info) => {
      queryClient.invalidateQueries(['backups']);
      toast.success(t('settings.data.backupCreated'));
      const res = await dataAPI.downloadBackup(info.filename);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    onError: () => toast.error(t('settings.data.backupError')),
  });

  const handleBackup = () => backupMutation.mutate();

  const handleDownloadBackup = async (name) => {
    try {
      const res = await dataAPI.downloadBackup(name);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error(t('settings.data.backupError'));
    }
  };

  if (isLoading) {
    return <div className="text-text-muted text-sm py-10">{t('common.loading')}</div>;
  }

  const stats = overview?.stats || {};
  const storage = overview?.storage || {};
  const materials = materialData?.materials || [];

  const CATEGORIES = [
    { key: 'subjects', label: t('settings.data.subjects'), icon: ICONS.nav.notebook },
    { key: 'materials', label: t('settings.data.materials'), icon: ICONS.files.document },
    { key: 'chats', label: t('settings.data.chats'), icon: ICONS.communication.chat },
    { key: 'messages', label: t('settings.data.messages'), icon: ICONS.communication.chat },
    { key: 'notes', label: t('settings.data.notes'), icon: ICONS.learning.bookmarks },
    { key: 'flashcards', label: t('settings.data.flashcards'), icon: ICONS.nav.flashcard },
    { key: 'quizzes', label: t('settings.data.quizzes'), icon: ICONS.ui.help },
    { key: 'examSessions', label: t('settings.data.examSessions'), icon: ICONS.nav.exam },
    { key: 'examBlueprints', label: t('settings.data.examBlueprints'), icon: ICONS.learning.grid },
    { key: 'questionBank', label: t('settings.data.questionBank'), icon: ICONS.ui.database },
  ];

  const STORAGE_ROWS = [
    { label: t('settings.data.storageUploads'), value: storage.uploads },
    { label: t('settings.data.storageTrash'), value: storage.trash },
  ];

  const mapKey = {
    subjects: 'subjects', materials: 'materials', chats: 'chats',
    messages: 'messages', notes: 'notes', flashcards: 'flashcards',
    quizzes: 'quizzes', examSessions: 'exam_sessions',
    examBlueprints: 'exam_blueprints', questionBank: 'question_bank',
  };

  return (
    <div className="space-y-8">
      {/* Count cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {CATEGORIES.map(({ key, label, icon }) => (
          <div key={key} className="card-base p-4 flex flex-col gap-1">
            <Icon name={icon} size={16} className="text-primary" />
            <span className="text-xl font-bold text-text">{stats[mapKey[key]] ?? 0}</span>
            <span className="text-xs text-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Material status */}
      <div className="card-base p-6 md:p-7">
        <h3 className="text-base font-semibold text-text mb-3">{t('settings.data.materials')}</h3>
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
      <div className="card-base p-6 md:p-7">
        <h3 className="text-base font-semibold text-text mb-3">
          {t('settings.data.materials')} ({materials.length} {t('settings.data.items')})
        </h3>
        {materials.length === 0 ? (
          <p className="text-text-muted text-sm">{t('settings.data.noMaterials')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted tr-divider">
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
                  <tr key={m.id} className="tr-divider last:border-0">
                    <Tooltip label={m.filename}>
                      <td className="py-2 pr-3 text-text max-w-[220px] truncate">
                        {m.filename}
                      </td>
                    </Tooltip>
                    <td className="py-2 pr-3 text-text-secondary">{m.subject?.name || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{m.material_type || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={cn('px-1.5 py-0.5 rounded border text-3xs font-medium',
                        STATUS_BADGE[m.status] || 'bg-card border-border text-text-secondary')}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{formatBytes(m.size_bytes)}</td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {m.upload_date ? formatDate(m.upload_date) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Tooltip label={t('common.delete')}>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={deleteMutation.isPending}
                          aria-label={t('common.delete')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === m.id ? (
                            <Icon name={ICONS.status.loading} size={14} className="animate-spin" />
                          ) : (
                            <Icon name={ICONS.actions.delete} size={14} />
                          )}
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backup / Export */}
      <div className="card-base p-6 md:p-7">
        <h3 className="text-base font-semibold text-text mb-1 flex items-center gap-2">
          <Icon name={ICONS.ui.archive} size={15} className="text-primary" />
          {t('settings.data.backupTitle')}
        </h3>
        <p className="text-xs text-text-muted mb-4">{t('settings.data.backupDesc')}</p>

        <Button
          onClick={handleBackup}
          disabled={backupMutation.isPending}
          className="px-4 py-2 rounded-xl text-sm flex items-center gap-2"
         variant="primary">
          {backupMutation.isPending ? (
            <Icon name={ICONS.status.loading} size={15} className="animate-spin" />
          ) : (
            <Icon name={ICONS.actions.download} size={15} />
          )}
          {backupMutation.isPending ? t('settings.data.backupCreating') : t('settings.data.backupCreate')}
        </Button>

        <p className="text-3xs text-text-muted mt-2 leading-relaxed">{t('settings.data.backupNote')}</p>

        <div className="mt-4">
          <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            {t('settings.data.backupRecent')}
          </p>
          {(!backups?.backups || backups.backups.length === 0) ? (
            <p className="text-xs text-text-muted">{t('settings.data.backupEmpty')}</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {backups.backups.map((b) => (
                <div key={b.filename} className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <Tooltip label={b.filename}>
                      <p className="text-xs text-text truncate">{b.filename}</p>
                    </Tooltip>
                    <p className="text-3xs text-text-muted">
                      {b.created_at} · {formatBytes(b.size)}
                    </p>
                  </div>
                  <Tooltip label={t('settings.data.backupDownload')}>
                    <button
                      onClick={() => handleDownloadBackup(b.filename)}
                      aria-label={t('settings.data.backupDownload')}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Icon name={ICONS.actions.download} size={13} />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trash (Sampah) */}
      <div className="card-base p-6 md:p-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Icon name={ICONS.actions.delete} size={15} className="text-danger" />
            {t('settings.data.trash')} ({trashData?.items?.length || 0})
          </h3>
          {(trashData?.items?.length || 0) > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={emptyTrashMutation.isPending}
              className="text-xs text-text-muted hover:text-danger transition-colors"
            >
              {emptyTrashMutation.isPending ? <Icon name={ICONS.status.loading} size={13} className="animate-spin inline" /> : t('settings.data.trashEmpty')}
            </button>
          )}
        </div>

        {(trashData?.items?.length || 0) === 0 ? (
          <p className="text-text-muted text-sm">{t('settings.data.noTrash')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted tr-divider">
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashName')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashOrigin')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashSize')}</th>
                  <th className="py-2 pr-3 font-medium">{t('settings.data.trashDate')}</th>
                  <th className="py-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {trashData.items.map((item) => (
                  <tr key={item.id} className="tr-divider last:border-0">
                    <Tooltip label={item.original_filename}>
                      <td className="py-2 pr-3 text-text max-w-[220px] truncate">
                        {item.original_filename}
                      </td>
                    </Tooltip>
                    <td className="py-2 pr-3 text-text-secondary">
                      <span className={cn('px-1.5 py-0.5 rounded border text-3xs font-medium',
                        item.material_id ? 'bg-warning/15 text-warning border-warning/30' : 'bg-card border-border text-text-secondary')}>
                        {item.material_id ? t('settings.data.trashFromMaterial') : t('settings.data.trashOrphan')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{formatBytes(item.size_bytes)}</td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {item.trashed_at ? formatDate(item.trashed_at) : '—'}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Tooltip label={t('settings.data.trashRestore')}>
                        <button
                          onClick={() => handleRestore(item)}
                          disabled={restoreMutation.isPending}
                          aria-label={t('settings.data.trashRestore')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors mr-1"
                        >
                          <Icon name={ICONS.actions.replay} size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('settings.data.trashDeleteForever')}>
                        <button
                          onClick={() => handleDeleteTrash(item)}
                          disabled={deleteTrashMutation.isPending}
                          aria-label={t('settings.data.trashDeleteForever')}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Icon name={ICONS.status.error} size={14} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage */}
      <div className="card-base p-6 md:p-7">
        <h3 className="text-base font-semibold text-text mb-3 flex items-center gap-2">
          <Icon name={ICONS.ui.storage} size={15} className="text-primary" />
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