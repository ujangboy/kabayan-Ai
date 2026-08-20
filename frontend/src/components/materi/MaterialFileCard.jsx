import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';

import FileTypeIcon, { FILE_COLOR_MAP } from '@/components/FileTypeIcon';
import { Tooltip , Icon } from '@/components/ui';
import { formatDate } from '@/utils';

const FILE_TINT = {
  YOUTUBE: 'bg-violet/10',
  PDF: 'bg-danger/10',
  DOCX: 'bg-info/10',
  PPT: 'bg-orange/10',
  XLS: 'bg-success/10',
  TXT: 'bg-text-secondary/10',
  CSV: 'bg-success/10',
  MARKDOWN: 'bg-primary/10',
};

function fileTint(type) {
  const t = String(type || '').toUpperCase();
  const key = Object.keys(FILE_TINT).find((k) => t.includes(k));
  return key ? FILE_TINT[key] : 'bg-text-secondary/10';
}

export function MaterialFileCard({ material: m, index, showSubject, isRagActive, onToggleRag, onDelete, onCancel }) {
  const { t } = useTranslation();
  const iconColor = FILE_COLOR_MAP[String(m.material_type || '').toUpperCase().includes('YOUTUBE') ? 'YOUTUBE' : m.material_type] || 'text-text-secondary';

  return (
    <motion.div
      layout={{ transition: { duration: 0.25 } }}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay: Math.min(index * 0.04, 0.4), duration: 0.25 },
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="card-base group relative flex flex-col gap-3 hover:shadow-glass-lg hover:border-purple-500/40 hover:bg-slate-800/70 transition-[box-shadow,border-color,background-color] duration-300"
    >
      {/* Top: icon + name + delete */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${fileTint(m.material_type)}`}>
          <FileTypeIcon type={m.material_type} className={`text-xl ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text font-medium text-sm leading-tight truncate" title={m.filename}>{m.filename}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{m.material_type}</p>
          {showSubject && (m.subject?.name) && (
            <p className="text-[11px] text-text-secondary mt-1 truncate" title={m.subject.name}>
              <Icon name={ICONS.files.folder} size={10} className="inline text-amber mr-1" />{m.subject.name}
            </p>
          )}
        </div>
        <Tooltip label={t('materi.deleteMateriTitle')}>
          <button
            onClick={onDelete}
            aria-label={t('materi.deleteMateriTitle')}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all shrink-0"
          >
            <Icon name={ICONS.actions.delete} size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Status + progress */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`badge ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}
                title={m.status === 'Failed' && m.failure_reason ? m.failure_reason : ''}>
            {m.status}
          </span>
          <span className="text-[10px] text-text-muted">{formatDate(m.upload_date)}</span>
        </div>
        {(m.status === 'Pending' || m.status === 'Processing') && (
          <div className="space-y-1">
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${m.status === 'Pending' ? 'bg-text-muted' : 'bg-gradient-primary'}`}
                style={{ width: `${Math.max(m.progress || 0, 4)}%` }}
              />
            </div>
            <div className="flex items-center gap-1">
              <div className="text-[10px] text-text-muted leading-tight truncate flex-1" title={m.stage || t('materi.waitingForProcess')}>
                {m.status === 'Pending' ? t('materi.waitingInQueue') : (m.stage || t('materi.processing'))}
              </div>
              <Tooltip label={t('materi.cancelProcessing')}>
                <button
                  onClick={onCancel}
                  className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                  aria-label={t('materi.cancelProcessing')}
                >
                  <Icon name={ICONS.actions.close} size={11} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {m.status === 'Failed' && m.failure_reason && (
          <div className="text-[10px] text-danger leading-tight break-words" title={m.failure_reason}>
            {m.failure_reason}
          </div>
        )}
      </div>

      {/* RAG toggle */}
      <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">{t('materi.enableAsRagSource')}</span>
        <Tooltip label={m.status !== 'Ready' ? t('materi.notReady', { status: m.status }) : t('materi.enableAsRagSource')}>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={isRagActive}
              onChange={onToggleRag}
              disabled={m.status !== 'Ready'}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="h-4 w-7 rounded-full bg-border relative transition-colors cursor-pointer
                peer-checked:bg-gradient-primary
                peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50
                peer-disabled:opacity-30 peer-disabled:cursor-not-allowed
                after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:rounded-full after:bg-white
                after:transition-transform after:duration-200 peer-checked:after:translate-x-3"
            />
          </label>
        </Tooltip>
      </div>
    </motion.div>
  );
}
