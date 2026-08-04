import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { materiAPI, audioAPI } from '@/services/api';
import { useAppStore } from '@/store';

export default function BackgroundProcessSync() {
  const addPendingOperation = useAppStore((s) => s.addPendingOperation);
  const removePendingOperation = useAppStore((s) => s.removePendingOperation);
  // Hanya op yang "dipantau" sinkronisasi yang boleh dihapus oleh sync.
  // Op yang baru di-start komponen (belum tercatat DB) tidak ikut terhapus → anti-race.
  const syncedOpsRef = useRef(new Set());

  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materiAPI.getAll().then((r) => r.data),
    refetchInterval: (query) => {
      const mats = query.state.data?.materials || [];
      return mats.some((m) => m.status === 'Pending' || m.status === 'Processing') ? 3000 : 15000;
    },
  });

  const { data: audioData } = useQuery({
    queryKey: ['audioStatuses'],
    queryFn: () => audioAPI.statuses(),
    refetchInterval: (query) => {
      const processing = query.state.data?.processing || [];
      return processing.length > 0 ? 3000 : 15000;
    },
  });

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
    // Hapus op proses yang sync sendiri pantau dan sudah tidak aktif
    for (const op of [...synced]) {
      if (op.startsWith('process-') && !active.has(op)) {
        removePendingOperation(op);
        synced.delete(op);
      }
    }
  }, [materialsData, addPendingOperation, removePendingOperation]);

  useEffect(() => {
    const active = new Set((audioData?.processing || []).map((a) => `audio-${a.material_id}`));
    const synced = syncedOpsRef.current;
    for (const op of active) {
      synced.add(op);
      addPendingOperation(op);
    }
    // Hapus op audio yang sync sendiri pantau dan sudah tidak aktif
    for (const op of [...synced]) {
      if (op.startsWith('audio-') && !active.has(op)) {
        removePendingOperation(op);
        synced.delete(op);
      }
    }
  }, [audioData, addPendingOperation, removePendingOperation]);

  return null;
}
