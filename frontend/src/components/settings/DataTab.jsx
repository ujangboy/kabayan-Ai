import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, FileText, MessageSquare, BookMarked, CreditCard,
  HelpCircle, Brain, LayoutTemplate, Database as DatabaseIcon, HardDrive,
} from 'lucide-react';
import { dataAPI, materiAPI } from '@/services/api';
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

  const { data: overview, isLoading } = useQuery({
    queryKey: ['data-overview'],
    queryFn: () => dataAPI.overview().then((r) => r.data),
  });

  const { data: materialData } = useQuery({
    queryKey: ['materials', 'all'],
    queryFn: () => materiAPI.getAll().then((r) => r.data),
  });

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
                  <th className="py-2 font-medium">{t('settings.data.materialUploaded')}</th>
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
                    <td className="py-2 text-text-secondary">
                      {m.upload_date ? formatDate(m.upload_date) : '—'}
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