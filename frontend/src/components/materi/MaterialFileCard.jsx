import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';

import FileTypeIcon, { FILE_COLOR_MAP } from '@/components/FileTypeIcon';
import { Tooltip , Icon } from '@/components/ui';
import { getSubjectPalette } from '@/components/ui/SubjectBadge';
import { formatDate } from '@/utils';
import { getMaterialStatusLabel } from '@/utils/status';
import { cn } from '@/utils';

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

export function MaterialFileCard({ material: m, index, showSubject, isRagActive, onToggleRag, onDelete, onCancel, onAudio, highlighted = false }) {
  const { t } = useTranslation();
  const iconColor = FILE_COLOR_MAP[String(m.material_type || '').toUpperCase().includes('YOUTUBE') ? 'YOUTUBE' : m.material_type] || 'text-text-secondary';
  const statusLabel = getMaterialStatusLabel(t, m.status);
  // Warna identitas mata kuliah (deterministik per subject_id) — konsisten
  // dengan badge/folder/deck di halaman lain.
  const subjectTone = showSubject ? getSubjectPalette(m.subject_id ?? m.subject?.id) : null;

  return (
    <motion.div
      id={`highlight-${m.id}`}
      layout={{ transition: { duration: 0.25 } }}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay: Math.min(index * 0.04, 0.4), duration: 0.25 },
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`card-base card-hoverable group relative flex flex-col gap-3 ${highlighted ? 'ring-2 ring-warning/60 bg-warning/5 animate-pulse' : ''}`}
    >
      {/* Top: icon + nama file. Aksi mengambang agar nama tidak terpotong. */}
      <div className="relative flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${fileTint(m.material_type)}`}>
          <FileTypeIcon type={m.material_type} className={`text-xl ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1 pr-10 md:pr-0">
          <Tooltip label={m.filename}>
            <p className="line-clamp-2 break-words text-[13.5px] font-semibold leading-snug text-text">
              {m.filename.replaceAll('_', ' ')}
            </p>
          </Tooltip>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{m.material_type}</p>
          {showSubject && (m.subject?.name) && (
            <Tooltip label={m.subject.name}>
              <p className="mt-1 truncate text-[11px] text-text-secondary">
                <Icon name={ICONS.files.folder} size={10} className={cn('mr-1 inline', subjectTone ? subjectTone.icon : 'text-warning')} />{m.subject.name}
              </p>
            </Tooltip>
          )}
        </div>
        <div className="absolute right-0 top-0 flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <Tooltip label={t('nav.audio')}>
            <button
              onClick={onAudio}
              aria-label={t('nav.audio')}
              disabled={m.status !== 'Ready'}
              className="rounded-lg bg-surface/90 p-1.5 text-text-secondary backdrop-blur-sm transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon name={ICONS.nav.audio} size={15} />
            </button>
          </Tooltip>
          <Tooltip label={t('materi.deleteMateriTitle')}>
            <button
              onClick={onDelete}
              aria-label={t('materi.deleteMateriTitle')}
              className="rounded-lg bg-surface/90 p-1.5 text-text-secondary backdrop-blur-sm transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Icon name={ICONS.actions.delete} size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Status + progress */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Tooltip label={m.status === 'Failed' && m.failure_reason ? m.failure_reason : ''}>
            <span className={`badge ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
              {statusLabel}
            </span>
          </Tooltip>
          <span className="text-3xs text-text-muted">{formatDate(m.upload_date)}</span>
        </div>
        {(m.status === 'Pending' || m.status === 'Processing') && (
          <div className="space-y-1">
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full w-full origin-left transition-transform duration-700 ${m.status === 'Pending' ? 'bg-text-muted' : 'bg-primary'}`}
                style={{ transform: `scaleX(${Math.max(m.progress || 0, 4) / 100})` }}
              />
            </div>
            <div className="flex items-center gap-1">
              <Tooltip label={m.stage || t('materi.waitingForProcess')}>
                <div className="text-3xs text-text-muted leading-tight truncate flex-1">
                  {m.status === 'Pending' ? t('materi.waitingInQueue') : (m.stage || t('materi.processing'))}
                </div>
              </Tooltip>
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
          <Tooltip label={m.failure_reason}>
            <div className="text-3xs text-danger leading-tight break-words">
              {m.failure_reason}
            </div>
          </Tooltip>
        )}
      </div>

      {/* RAG toggle */}
      <div className="mt-auto pt-2 border-t border-border flex items-center justify-between">
        <span className="text-2xs text-text-muted">{t('materi.enableAsRagSource')}</span>
        <Tooltip label={m.status !== 'Ready' ? t('materi.notReady', { status: statusLabel }) : t('materi.enableAsRagSource')}>
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
                peer-checked:bg-primary
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