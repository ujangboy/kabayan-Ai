import { useCallback } from 'react';
import { useJobStore } from '@/store/jobStore';
import { extractErrorMessage } from '@/utils/errors';

/**
 * Jalankan pekerjaan async (generate AI / audio) yang harus tetap berjalan
 * walau komponen pembuka di-unmount (user pindah menu).
 *
 *   const { run } = useBackgroundJob();
 *   run('quiz', t('appLayout.opQuiz'), (signal) => quizAPI.generate(payload, { signal }), {
 *     onError: (e) => toast.error(extractErrorMessage(e)),
 *     onDone: (res) => { ... },
 *   });
 *
 * Job bertahan di `useJobStore.jobs` sehingga `PendingBanner` bisa menampilkan
 * progress + tombol Batal (memanggil `controller.abort()`).
 */
export function useBackgroundJob() {
  const startJob = useJobStore((s) => s.startJob);
  const finishJob = useJobStore((s) => s.finishJob);
  const setController = useJobStore((s) => s.setController);

  const run = useCallback(
    async (key, label, fn, { onError, onDone } = {}) => {
      const controller = new AbortController();
      setController(key, controller);
      const type = typeof key === 'string' ? key.split('-')[0] : 'job';
      startJob(key, { type, label });
      try {
        const result = await fn(controller.signal);
        finishJob(key);
        onDone?.(result);
        return result;
      } catch (err) {
        finishJob(key);
        const aborted =
          err?.name === 'CanceledError' ||
          err?.code === 'ERR_CANCELED' ||
          err?.message?.toLowerCase?.().includes('cancel');
        if (!aborted) onError?.(err);
        throw err;
      } finally {
        setController(key, null);
      }
    },
    [startJob, finishJob, setController]
  );

  return { run };
}

export { extractErrorMessage };
