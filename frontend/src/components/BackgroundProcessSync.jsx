import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { materiAPI, audioAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { useJobStore } from '@/store/jobStore';

/**
 * Sinkronisasi job background ke banner global (AppLayout PendingBanner):
 *  - Material yang masih Pending/Processing  -> pendingOperations ('process-<id>')
 *  - Audio TTS yang masih Processing         -> jobStore audio jobs (biar banner
 *    tetap muncul walau user sedang di halaman lain)
 */
export default function BackgroundProcessSync() {
  const addPendingOperation = useAppStore((s) => s.addPendingOperation);
  const removePendingOperation = useAppStore((s) => s.removePendingOperation);
  const syncedOpsRef = useRef(new Set());

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materiAPI.getAll().then((r) => r.data),
    refetchInterval: (query) => {
      const mats = query.state.data?.materials || [];
      return mats.some((m) => m.status === 'Pending' || m.status === 'Processing') ? 3000 : 15000;
    },
  });

  // Material sync (tetap seperti sebelumnya)
  useEffect(() => {
    const active = new Set();
    for (const m of materialsData?.materials || []) {
      if (m.status === 'Pending' || m.status === 'Processing') {
        active.add(`process-${m.id}`);
      }
    }
    const synced = syncedOpsRef.current;
    for (const op of active) {
      synced.add(op);
      addPendingOperation(op);
    }
    for (const op of [...synced]) {
      if (op.startsWith('process-') && !active.has(op)) {
        removePendingOperation(op);
        synced.delete(op);
      }
    }
  }, [materialsData, addPendingOperation, removePendingOperation]);

  // Audio sync (poll global agar banner tahu job audio di halaman lain)
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
    const jobs = audioData?.audio || [];
    const store = useJobStore.getState();
    const liveKeys = new Set();
    for (const j of jobs) {
      if (j.status === 'Processing') {
        const key = `audio-${j.id}`;
        liveKeys.add(key);
        store.setAudioJob(key, j.id, 'Audio');
      }
    }
    // Hapus job audio yang sudah tidak ada / tidak lagi Processing
    for (const key of Object.keys(store.jobs)) {
      if (key.startsWith('audio-') && !liveKeys.has(key)) {
        store.removeJob(key);
      }
    }
  }, [audioData]);

  return null;
}
