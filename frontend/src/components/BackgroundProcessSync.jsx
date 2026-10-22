import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { materiAPI, audioAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { useJobStore } from '@/store/jobStore';
import { useToast } from '@/components/Toast';

/**
 * Sinkronisasi job background ke banner global (AppLayout PendingBanner):
 *  - Material yang masih Pending/Processing  -> pendingOperations ('process-<id>')
 *  - Audio TTS yang masih Processing         -> jobStore audio jobs (biar banner
 *    tetap muncul walau user sedang di halaman lain)
 *
 * Komponen ini juga menjadi satu-satunya tempat yang menampilkan toast
 * penyelesaian global. Dengan begitu notifikasi "AI selesai" tetap muncul
 * meskipun halaman/modal yang memulai job sudah di-unmount.
 */
export default function BackgroundProcessSync() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const addPendingOperation = useAppStore((s) => s.addPendingOperation);
  const removePendingOperation = useAppStore((s) => s.removePendingOperation);
  const pendingOperations = useAppStore((s) => s.pendingOperations);
  const completedJobs = useJobStore((s) => s.completed);
  const ackCompleted = useJobStore((s) => s.ackCompleted);
  const syncedOpsRef = useRef(new Set());

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materiAPI.getAll().then((r) => r.data),
    refetchInterval: (query) => {
      const mats = query.state.data?.materials || [];
      return mats.some((m) => m.status === 'Pending' || m.status === 'Processing') ? 3000 : 15000;
    },
  });

  // Material sync: tampilkan banner saat diproses dan toast saat selesai/gagal.
  useEffect(() => {
    const materials = materialsData?.materials || [];
    const active = new Set();
    const statusById = new Map();
    for (const m of materials) {
      statusById.set(m.id, m);
      if (m.status === 'Pending' || m.status === 'Processing') {
        active.add(`process-${m.id}`);
      }
    }

    const synced = syncedOpsRef.current;
    for (const op of active) {
      synced.add(op);
      addPendingOperation(op);
    }

    // Rekonsiliasi semua operasi process-* yang terdaftar, termasuk yang
    // didaftarkan langsung oleh UploadModal. File kecil bisa selesai sebelum
    // polling pertama, jadi status akhir harus tetap memicu toast.
    for (const op of [...pendingOperations]) {
      if (!op.startsWith('process-') || active.has(op)) continue;
      const id = Number(op.slice('process-'.length));
      const material = statusById.get(id);
      // Jangan hapus operasi sebelum query materi memuat ID tersebut; query
      // pertama bisa masih berupa cache lama tepat setelah upload.
      if (!material) continue;
      removePendingOperation(op);
      synced.delete(op);
      if (material.status === 'Ready') {
        toast.success(t('appLayout.opDone', { label: material.filename || t('appLayout.opProcess') }));
      } else if (material.status === 'Failed') {
        toast.error(
          material.failure_reason || material.error
            ? t('appLayout.opFailedWithReason', {
                label: material.filename || t('appLayout.opProcess'),
                error: material.failure_reason || material.error,
              })
            : t('appLayout.opFailed', { label: material.filename || t('appLayout.opProcess') })
        );
      }
    }
  }, [materialsData, pendingOperations, addPendingOperation, removePendingOperation, toast, t]);

  // Audio sync: polling global agar banner + toast tetap hidup di halaman lain.
  const { data: audioData } = useQuery({
    queryKey: ['audio-bg-sync'],
    queryFn: async () => (await audioAPI.list()) ?? { audio: [] },
    refetchInterval: (query) => {
      const jobs = query.state.data?.audio || [];
      return jobs.some((j) => j.status === 'Processing') ? 3000 : 15000;
    },
    retry: false,
  });

  useEffect(() => {
    // Jangan sentuh job sebelum daftar audio pertama kali berhasil dimuat:
    // effect awal dengan `audioData` undefined bisa menghapus job yang baru
    // dibuat dari halaman Audio sebelum query sempat melihat record-nya.
    if (!audioData) return;
    const jobs = audioData.audio || [];
    const store = useJobStore.getState();
    for (const j of jobs) {
      const key = `audio-${j.id}`;
      if (j.status === 'Processing') {
        store.setAudioJob(key, j.id, t('appLayout.opAudio'), {
          progress: j.progress,
          stage: j.stage,
          label: t('appLayout.opAudio'),
        });
      } else if (j.status === 'Cancelled') {
        store.removeJob(key);
      } else if (store.jobs[key]) {
        store.finishJob(key, {
          status: j.status === 'Ready' ? 'success' : 'error',
          error: j.error || '',
          label: t('appLayout.opAudio'),
        });
      }
    }
  }, [audioData, t]);

  // Toast global untuk job async (quiz, flashcard, exam, audio, dsb.).
  useEffect(() => {
    if (!completedJobs.length) return;
    const ids = [];
    for (const job of completedJobs) {
      ids.push(job.completedId);
      if (job.notify === false) continue;
      const label = job.label || t('appLayout.opFallback');
      if (job.status === 'success') {
        toast.success(t('appLayout.opDone', { label }));
      } else if (job.status === 'error') {
        toast.error(
          job.error
            ? t('appLayout.opFailedWithReason', { label, error: job.error })
            : t('appLayout.opFailed', { label })
        );
      }
    }
    ackCompleted(ids);
  }, [completedJobs, ackCompleted, toast, t]);

  return null;
}
