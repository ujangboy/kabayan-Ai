import { create } from 'zustand';

// Focus Mode (PRD US5.2) — overlay fullscreen tanpa sidebar/nav.
// State ephemeral (tidak dipersist): fokus berakhir saat pindah halaman/refresh.
export const useFocusStore = create((set) => ({
  isFocusMode: false,
  focusActivity: null, // { type, to, label, subjectId }
  enterFocus: (activity) => set({ isFocusMode: true, focusActivity: activity || null }),
  exitFocus: () => set({ isFocusMode: false, focusActivity: null }),
}));
