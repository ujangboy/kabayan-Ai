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
  const removeJob = useJobStore((s) => s.removeJob);
  const setController = useJobStore((s) => s.setController);

  const run = useCallback(
    async (key, label, fn, { onError, onDone, storeResult = false, notify = true } = {}) => {
      const controller = new AbortController();
      setController(key, controller);
      const type = typeof key === 'string' ? key.split('-')[0] : 'job';
      startJob(key, { type, label });
      try {
        const result = await fn(controller.signal);
        // Sebagian endpoint mengembalikan HTTP 200 dengan body {detail: ...}
        // untuk kegagalan domain. Jangan tampilkan toast "selesai" untuk kasus ini.
        if (result && typeof result === 'object' && typeof result.detail === 'string' && result.detail) {
          const detailError = new Error(result.detail);
          finishJob(key, { status: 'error', error: result.detail, notify });
          onError?.(detailError);
          return result;
        }
        finishJob(key, {
          status: 'success',
          notify,
          ...(storeResult ? { result } : {}),
        });
        onDone?.(result);
        return result;
      } catch (err) {
        const aborted =
          err?.name === 'CanceledError' ||
          err?.code === 'ERR_CANCELED' ||
          err?.message?.toLowerCase?.().includes('cancel');
        if (aborted) {
          // Dibatalkan pengguna: jangan tampilkan toast "selesai"/"gagal".
          removeJob(key);
        } else {
          finishJob(key, {
            status: 'error',
            error: extractErrorMessage(err),
          });
          onError?.(err);
        }
        throw err;
      } finally {
        setController(key, null);
      }
    },
    [startJob, finishJob, removeJob, setController]
  );

  return { run };
}

export { extractErrorMessage };
