import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// State halaman (view, progres sesi, dsb.) yang harus bertahan saat user pindah
// menu atau me-refresh. Setiap entry punya TTL (default 24 jam) — setelah
// kedaluwarsa otomatis dihapus agar tidak menumpuk selamanya.
export const PAGE_STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

export const usePageStateStore = create(
  persist(
    (set, get) => ({
      states: {}, // key → { savedAt: number, data: unknown }

      save: (key, data) => {
        if (key == null) return;
        set((s) => ({
          states: {
            ...s.states,
            [key]: { savedAt: Date.now(), data },
          },
        }));
      },

      load: (key) => {
        if (key == null) return null;
        const entry = get().states[key];
        if (!entry) return null;
        if (Date.now() - entry.savedAt > PAGE_STATE_TTL_MS) {
          set((s) => {
            const { [key]: _drop, ...rest } = s.states;
            return { states: rest };
          });
          return null;
        }
        return entry.data;
      },

      clear: (key) => {
        if (key == null) return;
        set((s) => {
          const { [key]: _drop, ...rest } = s.states;
          return { states: rest };
        });
      },

      resetAll: () => set({ states: {} }),
    }),
    {
      name: 'kabayan-page-state',
      version: 1,
      // Setiap save di-wrap try/catch oleh zustand — jika kuota localStorage
      // hampir penuh, entry yang melampaui batas dibuang otomatis.
      serialize: (state) => JSON.stringify(state),
      deserialize: (str) => JSON.parse(str),
    }
  )
);