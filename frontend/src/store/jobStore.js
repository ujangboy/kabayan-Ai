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

  startJob: (key, meta = {}) =>
    set((s) => ({
      jobs: { ...s.jobs, [key]: { key, startedAt: Date.now(), status: 'running', ...meta } },
    })),

  finishJob: (key) =>
    set((s) => {
      if (!s.jobs[key]) return s;
      const { [key]: _drop, ...rest } = s.jobs;
      return { jobs: rest };
    }),

  // Penanda job audio agar banner tahu caranya membatalkan (via API, bukan fetch).
  setAudioJob: (key, audioId, label) =>
    set((s) => ({
      jobs: { ...s.jobs, [key]: { key, type: 'audio', label, startedAt: Date.now(), status: 'running', audioId } },
    })),

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
