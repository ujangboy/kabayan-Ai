import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore, useUiStore } from '@/store';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Plus, Trash2, X, Video, Folder, LayoutTemplate } from '@/icons';
import { materiAPI, subjectAPI } from '@/services/api';
import { formatDate } from '@/utils';
import FileTypeIcon, { FILE_COLOR_MAP } from '@/components/FileTypeIcon';
import { useToast } from '@/components/Toast';
import { Tooltip, Modal, Button, Input, Select, EmptyState, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { usePendingOperation } from '@/hooks/usePendingOperation';

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

export default function MateriPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const processOp = usePendingOperation('process');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const subjectFilter = useUiStore((s) => s.subjectFilterMateri);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);

  // Read subject_id from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sid = params.get('subject_id');
    if (sid) setSubjectFilter('materi', sid);
    if (location.search) navigate('/materi', { replace: true });
  }, []);

  const { data: materiData, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materiAPI.getAll().then(r => r.data),
    refetchInterval: (query) => {
      const mats = query.state.data?.materials || [];
      return mats.some(m => m.status === 'Pending' || m.status === 'Processing') ? 4000 : false;
    }
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const materials = materiData?.materials || [];
  const subjects = subjectData?.subjects || [];
  const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  const filteredMaterials = subjectFilter
    ? materials.filter(m => String(m.subject_id ?? m.subject?.id) === subjectFilter)
    : materials;
  const { selectedDocs, setSelectedDocs } = useChatStore();

  const activeSubject = sortedSubjects.find(s => String(s.id) === subjectFilter);
  const activeCount = selectedDocs.filter(docId => materials.some(m => `mat_${m.id}` === docId && m.status === 'Ready')).length;

  const toggleSelection = (id) => {
    const key = `mat_${id}`;
    setSelectedDocs(selectedDocs.includes(key)
      ? selectedDocs.filter((doc) => doc !== key)
      : [...selectedDocs, key]
    );
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => materiAPI.delete(id),
    onSuccess: (_, deletedId) => {
      const key = `mat_${deletedId}`;
      setSelectedDocs(selectedDocs.filter((d) => d !== key));
      processOp.finish(`process-${deletedId}`);
      queryClient.invalidateQueries(['materials']);
    }
  });

  const cancelMaterialMutation = useMutation({
    mutationFn: (id) => materiAPI.cancel(id),
    onSuccess: (_, id) => {
      processOp.finish(`process-${id}`);
      queryClient.invalidateQueries(['materials']);
      toast.info(t('materi.processingCancelled'));
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err));
    }
  });

  const handleDelete = (id) => {
    toast.confirm({
      title: t('materi.deleteTitle', 'Hapus Materi'),
      message: t('materi.confirmDelete'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  const handleCancelProcessing = (id) => {
    toast.confirm({
      title: t('materi.cancelTitle', 'Batalkan Proses'),
      message: t('materi.confirmCancelProcessing'),
      danger: true,
      confirmLabel: t('common.cancel'),
      onConfirm: () => cancelMaterialMutation.mutate(id),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('materi.pageTitle')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t('materi.pageSubtitle')}</p>
            {activeCount > 0 && (
              <div className="mt-2 inline-flex items-center gap-2">
                <span className="badge badge-primary text-[11px]">{t('materi.ragActive', { count: activeCount })}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsYoutubeModalOpen(true)}
              className="btn-ghost border border-border text-xs"
            >
              <Video size={14} className="text-danger" />
              {t('materi.importYoutube')}
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-primary text-xs"
            >
              <Upload size={14} />
              {t('materi.uploadMateri')}
            </button>
          </div>
        </div>

        {/* Subjects folder cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={15} className="text-primary-light" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('nav.subjects')}</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {/* All Materials folder */}
            <FolderCard
              active={!subjectFilter}
              icon={Folder}
              name={t('materi.folderAll')}
              count={materials.length}
              onClick={() => setSubjectFilter('materi', '')}
            />
            {sortedSubjects.map((s) => {
              const count = materials.filter(m => String(m.subject_id ?? m.subject?.id) === String(s.id)).length;
              return (
                <FolderCard
                  key={s.id}
                  active={String(s.id) === subjectFilter}
                  icon={Folder}
                  name={s.name}
                  count={count}
                  onClick={() => setSubjectFilter('materi', String(s.id))}
                />
              );
            })}
            <button
              onClick={() => navigate('/subjects?new=1')}
              className="shrink-0 w-40 flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border text-text-muted hover:text-primary-light hover:border-primary/40 transition-colors"
            >
              <Plus size={20} />
              <span className="text-xs font-medium">{t('subjects.addNew')}</span>
            </button>
          </div>
        </div>

        {/* Breadcrumb / current folder */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <FileText size={15} className="text-primary-light" />
            <span className="text-text-secondary">{t('materi.filesTitle')}</span>
            <span className="text-text-muted">/</span>
            <span className="font-semibold text-text">{activeSubject ? activeSubject.name : t('materi.folderAll')}</span>
          </div>
          <span className="text-xs text-text-muted">
            {t('materi.showingCount', { shown: filteredMaterials.length, total: materials.length })}
          </span>
        </div>

        {/* File manager grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="card-base">
            <EmptyState icon={Upload} title={t('materi.emptyState')} />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="card-base">
            <EmptyState icon={Folder} title={t('materi.fileManagerEmpty')} />
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredMaterials.map((m, idx) => (
                <MaterialFileCard
                  key={m.id}
                  material={m}
                  index={idx}
                  showSubject={!subjectFilter}
                  isRagActive={selectedDocs.includes(`mat_${m.id}`)}
                  onToggleRag={() => m.status === 'Ready' && toggleSelection(m.id)}
                  onDelete={() => handleDelete(m.id)}
                  onCancel={() => handleCancelProcessing(m.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

      </div>

      {/* Upload & YouTube modals */}
      <UploadModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        subjects={sortedSubjects}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          queryClient.invalidateQueries(['materials']);
        }}
      />
      <YoutubeModal
        open={isYoutubeModalOpen}
        onClose={() => setIsYoutubeModalOpen(false)}
        subjects={sortedSubjects}
        onSuccess={() => {
          setIsYoutubeModalOpen(false);
          queryClient.invalidateQueries(['materials']);
        }}
      />
    </div>
  );
}

function FolderCard({ active, icon: Icon, name, count, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-40 text-left rounded-card border p-3 transition-all duration-200 group
        ${active
          ? 'bg-gradient-primary-soft border-primary/40 shadow-glow-sm'
          : 'bg-card border-border hover:border-primary/30 hover:bg-card-hover'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
          ${active ? 'bg-gradient-primary text-white shadow-btn-primary' : 'bg-text-secondary/10 text-text-muted group-hover:text-primary-light'}`}>
          <Icon size={18} />
        </div>
        <span className="text-[10px] font-medium text-text-muted bg-background/60 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${active ? 'text-primary-light' : 'text-text'}`} title={name}>{name}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">{t('materi.folderFiles', { count })}</p>
    </button>
  );
}

function MaterialFileCard({ material: m, index, showSubject, isRagActive, onToggleRag, onDelete, onCancel }) {
  const { t } = useTranslation();
  const iconColor = FILE_COLOR_MAP[String(m.material_type || '').toUpperCase().includes('YOUTUBE') ? 'YOUTUBE' : m.material_type] || 'text-text-secondary';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.25 }}
      className="card-base card-hoverable group relative flex flex-col gap-3"
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
              <Folder size={10} className="inline text-amber mr-1" />{m.subject.name}
            </p>
          )}
        </div>
        <Tooltip label={t('materi.deleteMateriTitle')}>
          <button
            onClick={onDelete}
            aria-label={t('materi.deleteMateriTitle')}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all shrink-0"
          >
            <Trash2 size={15} />
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
                  <X size={11} />
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
          <span className="inline-flex items-center">
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
          </span>
        </Tooltip>
      </div>
    </motion.div>
  );
}

function UploadModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !subjectId) return setError(t('materi.uploadSelectFileSubject'));
    setError('');
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', subjectId);
    try {
      const res = await materiAPI.upload(formData);
      if (res.data?.detail) throw new Error(res.data.detail);
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err) || t('materi.uploadFailedRetry'));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('materi.uploadModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button type="submit" form="upload-form" loading={isSubmitting} disabled={!file}>{t('materi.uploadAndProcess')}</Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('materi.subjectLabel')}</label>
          <Select
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">{t('materi.selectSubject')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('materi.uploadSelectFileLabel')}</label>
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary/15">
              <Upload size={24} className="text-primary-light" />
            </div>
            <p className="text-sm font-medium text-text">{file ? file.name : t('materi.uploadDropzone')}</p>
            <p className="mt-1 text-xs text-text-muted">{t('materi.uploadMaxSize')}</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv,.pptx,.xlsx"
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function YoutubeModal({ open, onClose, subjects, onSuccess }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url || !subjectId) return setError(t('materi.youtubeEnterUrlSubject'));
    setError('');
    setIsSubmitting(true);
    try {
      const res = await materiAPI.importYoutube({ url, subject_id: parseInt(subjectId) });
      if (res.data?.detail) throw new Error(res.data.detail);
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('materi.youtubeModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button variant="danger" type="submit" form="youtube-form" loading={isSubmitting} disabled={!url}>{t('materi.importTranscript')}</Button>
        </>
      }
    >
      <form id="youtube-form" onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{t('materi.subjectLabel')}</label>
          <Select
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">{t('materi.selectSubject')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
          />
          <p className="mt-1 text-[10px] text-text-muted">
            {t('materi.youtubeSubtitleInfo')}
            <br />
            {t('materi.youtubeSubtitleHelp')}
          </p>
        </div>
      </form>
    </Modal>
  );
}
