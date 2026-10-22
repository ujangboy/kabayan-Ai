import { create } from 'zustand';

/**
 * Registry job background (AI generate, audio TTS, dll.) yang harus tetap hidup
 * saat user pindah menu. Berbeda dengan `pendingOperations` (boolean set), di sini
 * kita simpan meta per-job + AbortController agar banner bisa menampilkan
 * "Batal" yang benar-benar membatalkan fetch.
 *
 * Store ini sengaja TIDAK di-persist (in-memory) — saat reload halaman, promise
 * fetch memang terputus (browser), tapi BackgroundProcessSync akan mengambil
 * kembali job materi/audio yang masih Processing dari API.
 */

// AbortController per key disimpan di module scope (bukan di state) agar tidak
// ikut ter-serialize dan tidak memicu re-render.
const controllers = new Map();

export const useJobStore = create((set, get) => ({
  jobs: {}, // key -> { key, type, label, startedAt, status: 'running', audioId? }
  // Job yang baru selesai. Dikonsumsi BackgroundProcessSync untuk toast global,
  // lalu di-ack agar tidak muncul lagi saat komponen remount.
  completed: [], // key -> { key, type, label, status, completedAt, completedId, ... }
  // Hasil job terakhir per key (mis. payload exam) agar komponen yang
  // di-unmount saat job selesai tetap bisa mengambil hasilnya saat kembali.
  results: {}, // key -> { status, result, at }

  startJob: (key, meta = {}) =>
    set((s) => {
      const existing = s.jobs[key];
      const restResults = Object.fromEntries(
        Object.entries(s.results || {}).filter(([resultKey]) => resultKey !== key)
      );
      return {
        jobs: {
          ...s.jobs,
          [key]: {
            key,
            // Jangan reset timer saat polling memperbarui job yang sama.
            startedAt: existing?.startedAt || Date.now(),
            status: 'running',
            ...meta,
          },
        },
        results: restResults,
      };
    }),

  finishJob: (key, meta = {}) =>
    set((s) => {
      const job = s.jobs[key];
      if (!job) return s;
      const { [key]: _drop, ...rest } = s.jobs;
      const hasResult = Object.prototype.hasOwnProperty.call(meta, 'result');
      return {
        jobs: rest,
        completed: [
          ...(s.completed || []),
          {
            ...job,
            ...meta,
            completedAt: Date.now(),
            completedId: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        ].slice(-20),
        results: hasResult
          ? {
              ...(s.results || {}),
              [key]: { status: meta.status || 'success', result: meta.result, at: Date.now() },
            }
          : s.results || {},
      };
    }),

  takeResult: (key, maxAgeMs = 15 * 60 * 1000) => {
    const entry = get().results?.[key];
    if (!entry) return null;
    if (Date.now() - entry.at > maxAgeMs) {
      set((s) => {
        const { [key]: _drop, ...rest } = s.results || {};
        return { results: rest };
      });
      return null;
    }
    set((s) => {
      const { [key]: _drop, ...rest } = s.results || {};
      return { results: rest };
    });
    return entry;
  },

  clearResult: (key) =>
    set((s) => {
      if (!s.results?.[key]) return s;
      const { [key]: _drop, ...rest } = s.results;
      return { results: rest };
    }),

  ackCompleted: (completedIds = []) =>
    set((s) => ({
      completed: (s.completed || []).filter((job) => !completedIds.includes(job.completedId)),
    })),

  // Penanda job audio agar banner tahu caranya membatalkan (via API, bukan fetch).
  setAudioJob: (key, audioId, label, meta = {}) =>
    set((s) => {
      const existing = s.jobs[key];
      return {
        jobs: {
          ...s.jobs,
          [key]: {
            ...existing,
            key,
            type: 'audio',
            label,
            audioId,
            startedAt: existing?.startedAt || Date.now(),
            status: 'running',
            ...meta,
          },
        },
      };
    }),

  removeJob: (key) =>
    set((s) => {
      if (!s.jobs[key]) return s;
      const { [key]: _drop, ...rest } = s.jobs;
      return { jobs: rest };
    }),

  setController: (key, ctrl) => {
    if (ctrl) controllers.set(key, ctrl);
    else controllers.delete(key);
  },
  getController: (key) => controllers.get(key) || null,
}));

/** Batalkan job berdasarkan key: abort fetch (jika sync) + hapus dari store. */
export function cancelJobByKey(key) {
  const ctrl = controllers.get(key);
  if (ctrl) ctrl.abort();
  controllers.delete(key);
  useJobStore.getState().removeJob(key);
}
