import { useCallback } from 'react';
import { useAppStore } from '@/store';

export function usePendingOperation(baseId) {
  const addPendingOperation = useAppStore((s) => s.addPendingOperation);
  const removePendingOperation = useAppStore((s) => s.removePendingOperation);

  const start = useCallback((opId) => {
    const key = opId ?? baseId;
    if (key == null) return;
    addPendingOperation(String(key));
  }, [addPendingOperation, baseId]);

  const finish = useCallback((opId) => {
    const key = opId ?? baseId;
    if (key == null) return;
    removePendingOperation(String(key));
  }, [removePendingOperation, baseId]);

  return { start, finish };
}
