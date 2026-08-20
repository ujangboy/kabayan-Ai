import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore, useUiStore } from '@/store';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Plus, Video, Folder, LayoutTemplate } from '@/icons';
import { materiAPI, subjectAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { EmptyState, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import { FolderCard } from '@/components/materi/FolderCard';
import { MaterialFileCard } from '@/components/materi/MaterialFileCard';
import { UploadModal } from '@/components/materi/UploadModal';
import { YoutubeModal } from '@/components/materi/YoutubeModal';

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

  // Read subject_id / upload from URL (re-run saat pindah param via sidebar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sid = params.get('subject_id');
    if (sid) setSubjectFilter('materi', sid);
    if (params.get('upload') === '1') setIsUploadModalOpen(true);
    if (location.search) navigate('/materi', { replace: true });
  }, [location.search]);

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
      <div className="w-full space-y-6">

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
