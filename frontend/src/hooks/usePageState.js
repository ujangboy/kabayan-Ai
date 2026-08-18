import { useCallback } from 'react';
import { usePageStateStore } from '@/store/pageStateStore';

// Helper untuk persistensi state halaman:
//   const { restore, persist, reset } = usePageState('exam-analyzer');
//   const saved = restore();            // state tersimpan atau null (TTL 24 jam)
//   persist({ view, blueprint, ... });  // simpan sebar data
//   reset();                            // buang state halaman
export function usePageState(key) {
  const save  = usePageStateStore((s) => s.save);
  const load  = usePageStateStore((s) => s.load);
  const clear = usePageStateStore((s) => s.clear);

  const restore = useCallback(() => load(key), [key, load]);
  const persistS = useCallback((data) => save(key, data), [key, save]);
  const reset   = useCallback(() => clear(key), [key, clear]);

  return { restore, persist: persistS, clear: reset };
}