import { create } from 'zustand';

/**
 * Pemutar audio global — CUMA SATU elemen <Audio> di seluruh aplikasi
 * (module scope, di luar lifecycle komponen) sehingga:
 *  - tidak mungkin dua audio berbunyi bersamaan (bug lama: tiap baris
 *    AudioItem punya <audio controls> masing-masing);
 *  - musik/narasi tetap jalan saat user pindah menu (elemen tak ikut
 *    unmount), MiniPlayer di AppLayout tinggal membaca state store.
 *
 * State TIDAK di-persist: reload halaman = kontrak browser memang
 * menghentikan elemen audio.
 */

// Singleton di module scope.
const el = new Audio();
el.preload = 'auto';

export const useAudioPlayerStore = create((set, get) => ({
  audioId: null, // id record audio yang aktif (null = mini player disembunyikan)
  src: null,
  title: '', // judul yang ditampilkan MiniPlayer
  subjectLabel: '', // nama mata kuliah (tooltip judul)
  isPlaying: false,
  error: '',

  /**
   * Putar track. Dipanggil baris AudioItem / tombol MiniPlayer:
   *  - track sama & sedang bunyi -> jeda;
   *  - track sama & sudah jeda   -> lanjut (play) — posisi dipertahankan;
   *  - track berbeda             -> ganti sumber, mulai dari awal.
   */
  toggle: ({ id, src, title, subjectLabel = '' } = {}) => {
    const st = get();
    const same = st.audioId === id && st.src === src;
    if (same && !el.paused) {
      el.pause();
      return;
    }
    if (!same) {
      el.src = src;
      set({ audioId: id, src, title: title || '', subjectLabel, error: '' });
    }
    // play() bisa gagal (sumber hilang, unsupported) — tangkap agar
    // tidak jadi unhandled rejection; error dibaca lewat store.
    el.play().catch((err) => {
      set({ error: err?.message || 'audio-play-failed', isPlaying: false });
    });
  },

  pause: () => el.pause(),

  // Hentikan total: reset sumber + tutup MiniPlayer.
  stop: () => {
    el.pause();
    el.removeAttribute('src');
    el.load();
    set({ audioId: null, src: null, title: '', subjectLabel: '', isPlaying: false, error: '' });
  },
}));

// ── Sinkronisasi event elemen -> store ──────────────────────────────────────
el.addEventListener('play', () => useAudioPlayerStore.setState({ isPlaying: true, error: '' }));
el.addEventListener('playing', () => useAudioPlayerStore.setState({ isPlaying: true }));
el.addEventListener('pause', () => useAudioPlayerStore.setState({ isPlaying: false }));
el.addEventListener('ended', () => useAudioPlayerStore.setState({ isPlaying: false }));
el.addEventListener('error', () => {
  // Hanya reaksi kalau punya sumber (error tanpa src biasanya noise).
  if (!el.currentSrc) return;
  useAudioPlayerStore.setState({
    error: 'audio-load-failed',
    isPlaying: false,
  });
});
