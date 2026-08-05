import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore, useUiStore } from '@/store';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Plus, Trash2, Headphones, Play, X, Video } from 'lucide-react';
import { materiAPI, subjectAPI, audioAPI } from '@/services/api';
import { formatDate, fileIcon } from '@/utils';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import AudioStatus from '@/components/AudioStatus';

export default function MateriPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const audioOp = usePendingOperation('audio');
  const processOp = usePendingOperation('process');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const subjectFilter = useUiStore((s) => s.subjectFilterMateri);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);

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
      // Bersihkan dari selectedDocs agar AI tidak pakai materi yang sudah dihapus
      const key = `mat_${deletedId}`;
      setSelectedDocs(selectedDocs.filter((d) => d !== key));
      processOp.finish(`process-${deletedId}`);
      audioOp.finish(`audio-${deletedId}`);
      queryClient.invalidateQueries(['materials']);
      queryClient.invalidateQueries(['audioStatuses']);
    }
  });

  const generateAudioMutation = useMutation({
    mutationFn: (id) => audioAPI.generate(id),
    onSuccess: (_, id) => {
      audioOp.start(`audio-${id}`);
      queryClient.invalidateQueries(['audioStatus']);
      queryClient.invalidateQueries(['audioStatuses']);
      toast.info(t('materi.audioGeneratingBackground'));
    },
    onError: (err, id) => {
      audioOp.finish(`audio-${id}`);
      toast.error(extractErrorMessage(err));
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

  const deleteAudioMutation = useMutation({
    mutationFn: (id) => audioAPI.delete(id),
    onSuccess: (_, id) => {
      audioOp.finish(`audio-${id}`);
      queryClient.invalidateQueries(['materials']);
      queryClient.invalidateQueries(['audioStatus']);
      queryClient.invalidateQueries(['audioStatuses']);
      toast.success(t('materi.audioDeleted'));
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err));
    }
  });

  const cancelAudioMutation = useMutation({
    mutationFn: (id) => audioAPI.cancel(id),
    onSuccess: (_, id) => {
      audioOp.finish(`audio-${id}`);
      queryClient.invalidateQueries(['audioStatus']);
      queryClient.invalidateQueries(['audioStatuses']);
      toast.info(t('materi.audioGenerationCancelled'));
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err));
    }
  });

  const handleDelete = (id) => {
    if (confirm(t('materi.confirmDelete'))) {
      deleteMutation.mutate(id);
    }
  };

  const handleAudio = (id) => {
    if (confirm(t('materi.confirmAudio'))) {
      generateAudioMutation.mutate(id);
    }
  };

  const handleRegenerateAudio = (id) => {
    // D5: hapus audio lama lalu buat ulang (backend menolak regen saat status 'done')
    deleteAudioMutation.mutate(id, {
      onSettled: () => generateAudioMutation.mutate(id),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('materi.pageTitle')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t('materi.pageSubtitle')}</p>
            {(() => {
              const activeCount = selectedDocs.filter(docId => materials.some(m => `mat_${m.id}` === docId && m.status === 'Ready')).length;
              if (activeCount > 0) {
                return (
                  <div className="mt-2 inline-flex items-center gap-2">
                    <span className="badge badge-primary text-[11px]">{t('materi.ragActive', { count: activeCount })}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsYoutubeModalOpen(true)}
              className="btn-ghost border border-border text-xs"
            >
              <Video size={14} className="text-red-500" />
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

        {/* Filter Mata Kuliah */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter('materi', e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">{t('materi.filterAllSubjects')}</option>
              {sortedSubjects.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <span className="text-xs text-text-muted">
              {t('materi.showingCount', { shown: filteredMaterials.length, total: materials.length })}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card-base overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-text-secondary w-4"></th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary w-5">#</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">{t('materi.colFilename')}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">{t('materi.colSubject')}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">{t('materi.colDate')}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">{t('materi.colStatus')}</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary">{t('materi.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-text-muted">{t('materi.loadingData')}</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-text-muted">{t('materi.emptyState')}</td>
                </tr>
              ) : filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-text-muted">{t('materi.noMaterialsForSubject')}</td>
                </tr>
              ) : (
                filteredMaterials.map((m, idx) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-border/50 hover:bg-background/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(`mat_${m.id}`)}
                        onChange={() => m.status === 'Ready' && toggleSelection(m.id)}
                        disabled={m.status !== 'Ready'}
                        title={m.status !== 'Ready' ? t('materi.notReady', { status: m.status }) : t('materi.enableAsRagSource')}
                        className="h-4 w-4 rounded appearance-none cursor-pointer
                          bg-slate-800 border-2 border-slate-500
                          checked:bg-primary checked:border-primary
                          focus:outline-none focus:ring-2 focus:ring-primary/50
                          disabled:opacity-30 disabled:cursor-not-allowed
                          transition-colors"
                      />
                    </td>
                    <td className="px-4 py-4 text-text-muted">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{fileIcon(m.material_type)}</span>
                        <div className="flex flex-col">
                          <span className="text-text font-medium max-w-[200px] sm:max-w-xs truncate" title={m.filename}>
                            {m.filename}
                          </span>
                          <span className="text-[10px] text-text-muted uppercase tracking-wider">{m.material_type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">{m.subject?.name || '—'}</td>
                    <td className="px-4 py-4 text-text-secondary">{formatDate(m.upload_date)}</td>
                    <td className="px-4 py-4 min-w-[160px]">
                      <div className="space-y-2">
                        <span className={`badge ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}
                              title={m.status === 'Failed' && m.failure_reason ? m.failure_reason : ''}>
                          {m.status}
                        </span>
                        {(m.status === 'Pending' || m.status === 'Processing') && (
                          <div className="space-y-1">
                            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-700 ${m.status === 'Pending' ? 'bg-text-muted' : 'bg-primary'}`}
                                style={{ width: `${Math.max(m.progress || 0, 4)}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="text-[10px] text-text-muted leading-tight truncate max-w-[150px]" title={m.stage || t('materi.waitingForProcess')}>
                                {m.status === 'Pending' ? t('materi.waitingInQueue') : (m.stage || t('materi.processing'))}
                              </div>
                              <button
                                onClick={() => { if (confirm(t('materi.confirmCancelProcessing'))) cancelMaterialMutation.mutate(m.id); }}
                                className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                                title={t('materi.cancelProcessing')}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        )}
                        {m.status === 'Failed' && m.failure_reason && (
                          <div className="text-[10px] text-danger leading-tight max-w-[160px] break-words" title={m.failure_reason}>
                            {m.failure_reason}
                          </div>
                        )}
                       <AudioStatus
                         materialId={m.id}
                         onCancel={(id) => cancelAudioMutation.mutate(id)}
                         onDelete={(id) => deleteAudioMutation.mutate(id)}
                         onRetry={handleAudio}
                         onRegenerate={handleRegenerateAudio}
                       />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Audio Button */}
                        <button
                          onClick={() => handleAudio(m.id)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-accent-teal hover:bg-accent-teal/10 transition-colors"
                          title={t('materi.audioPodcastTitle')}
                        >
                          <Headphones size={16} />
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                          title={t('materi.deleteMateriTitle')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Upload Modal placeholder */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <UploadModal
            onClose={() => setIsUploadModalOpen(false)}
            subjects={sortedSubjects}
            onSuccess={() => {
              setIsUploadModalOpen(false);
              queryClient.invalidateQueries(['materials']);
            }}
          />
        )}
        {isYoutubeModalOpen && (
          <YoutubeModal
            onClose={() => setIsYoutubeModalOpen(false)}
            subjects={sortedSubjects}
            onSuccess={() => {
              setIsYoutubeModalOpen(false);
              queryClient.invalidateQueries(['materials']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UploadModal({ onClose, subjects, onSuccess }) {
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
      const res = await fetch('/api/materials', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.detail || t('materi.uploadFailed'));
      }
      onSuccess();
    } catch (err) {
      setError(err.message && err.message.length < 200 ? err.message : t('materi.uploadFailedRetry'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text">{t('materi.uploadModalTitle')}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('materi.subjectLabel')}</label>
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">{t('materi.selectSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('materi.uploadSelectFileLabel')}</label>
            <div 
              className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} className="text-primary mb-2" />
              <p className="text-sm text-text font-medium">
                {file ? file.name : t('materi.uploadDropzone')}
              </p>
              <p className="text-xs text-text-muted mt-1">{t('materi.uploadMaxSize')}</p>
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
            <button type="submit" disabled={isSubmitting || !file} className="btn-primary">
              {isSubmitting ? t('materi.uploading') : t('materi.uploadAndProcess')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function YoutubeModal({ onClose, subjects, onSuccess }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md card-base shadow-2xl border-red-500/20"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Video size={20} className="text-red-500" />
            <h3 className="font-semibold text-text">{t('materi.youtubeModalTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('materi.subjectLabel')}</label>
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-red-500/50 transition-colors"
            >
              <option value="">{t('materi.selectSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-red-500/50 transition-colors"
            />
            <p className="text-[10px] text-text-muted mt-1">
              {t('materi.youtubeSubtitleInfo')}
              <br />
              {t('materi.youtubeSubtitleHelp')}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
            <button type="submit" disabled={isSubmitting || !url} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all">
              {isSubmitting ? t('materi.youtubeProcessing') : t('materi.importTranscript')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
