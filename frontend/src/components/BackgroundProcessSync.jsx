import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { materiAPI } from '@/services/api';
import { useAppStore } from '@/store';

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

  return null;
}