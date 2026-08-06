import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create(
  persist(
(set, get) => ({
      chats: [],
      currentChatId: null,
      selectedDocs: [],
      streamingChatIds: [],
      tutorBadge: null,

      createChat: () => {
        const chat = { id: Date.now(), title: 'Chat Baru', messages: [], pinned: false, createdAt: new Date().toISOString(), tutorEnabled: false, tutorSubject: '', tutorLevel: 'intermediate', examSessionId: null };
        set((s) => ({ chats: [chat, ...s.chats], currentChatId: chat.id }));
        return chat.id;
      },

      setCurrentChat: (id) => set({ currentChatId: id }),

      deleteChat: (id) => set((s) => {
        const chats = s.chats.filter((c) => c.id !== id);
        const currentChatId = s.currentChatId === id ? (chats[0]?.id || null) : s.currentChatId;
        return { chats, currentChatId };
      }),

      deleteAllChats: () => set({ chats: [], currentChatId: null }),

      togglePinChat: (id) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === id ? { ...c, pinned: !c.pinned } : c
        ),
      })),

      renameChat: (id, newTitle) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === id ? { ...c, title: newTitle } : c
        ),
      })),

      addMessage: (chatId, message) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId ? {
            ...c,
            messages: [...c.messages, { ...message, timestamp: new Date().toISOString() }],
            title: c.messages.length === 0 ? message.content.slice(0, 30) + '...' : c.title
          } : c
        ),
      })),

      updateLastMessage: (chatId, content) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, content } : m) }
            : c
        ),
      })),

      // Patch metadata (msgId, tier, dst.) pada pesan terakhir tanpa mengubah konten
      patchLastMessage: (chatId, patch) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, ...patch } : m) }
            : c
        ),
      })),

      // Simpan hasil feedback pada pesan tertentu (dicari berdasarkan msgId dari backend)
      setMessageFeedback: (chatId, msgId, rating) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m) => m.msgId === msgId ? { ...m, feedback: rating } : m) }
            : c
        ),
      })),

      getCurrentChat: () => {
        const { chats, currentChatId } = get();
        return chats.find((c) => c.id === currentChatId);
      },

      setSelectedDocs: (docs) => set({ selectedDocs: docs }),
      clearSelectedDocs: () => set({ selectedDocs: [] }),

      // Streaming state — diluar lifecycle komponen agar stream tetap hidup
      // saat user pindah menu (komponen ChatPage ter-unmount).
      // Mendukung beberapa chat streaming paralel (array, bukan pasangan tunggal).
      setStreaming: (isStreaming, chatId) => set((s) => {
        if (isStreaming) {
          if (chatId != null && !s.streamingChatIds.includes(chatId)) {
            return { streamingChatIds: [...s.streamingChatIds, chatId] };
          }
          return {};
        }
        if (chatId == null) return {};
        return { streamingChatIds: s.streamingChatIds.filter((id) => id !== chatId) };
      }),

      setTutorBadge: (tutorBadge) => set({ tutorBadge }),

      // Konfigurasi tutor disimpan PER-CHAT agar hanya aktif di sesi terpilih
      setChatTutor: (chatId, patch) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, tutorEnabled: patch.tutorEnabled ?? c.tutorEnabled, tutorSubject: patch.tutorSubject ?? c.tutorSubject ?? '', tutorLevel: patch.tutorLevel ?? c.tutorLevel ?? 'intermediate', examSessionId: patch.examSessionId ?? c.examSessionId ?? null }
            : c
        ),
      })),
    }),
    {
      name: 'kabayan-chat-store',
      partialize: (state) => {
        const { streamingChatIds: _scids, tutorBadge: _badge, ...rest } = state;
        return rest;
      },
    }
  )
);

// Filter mata kuliah per halaman — persist agar tidak reset saat pindah menu
export const useUiStore = create(
  persist(
    (set) => ({
      subjectFilterMateri: '',
      subjectFilterFlashcard: '',
      setSubjectFilter: (page, value) => set(
        page === 'flashcard'
          ? { subjectFilterFlashcard: String(value || '') }
          : { subjectFilterMateri: String(value || '') }
      ),
    }),
    { name: 'kabayan-ui-store' }
  )
);

export const useAppStore = create((set) => ({
  sidebarOpen: true,
  searchOpen: false,
  pendingOperations: new Set(),
  addPendingOperation: (id) => set((s) => {
    if (id == null) return {};
    const key = String(id);
    if (s.pendingOperations.has(key)) return {};
    const next = new Set(s.pendingOperations);
    next.add(key);
    return { pendingOperations: next };
  }),
  removePendingOperation: (idOrPredicate) => set((s) => {
    if (idOrPredicate == null) return {};
    const predicate = typeof idOrPredicate === 'function'
      ? idOrPredicate
      : (op) => op === String(idOrPredicate);
    let removed = false;
    const next = new Set(s.pendingOperations);
    for (const op of s.pendingOperations) {
      if (predicate(op)) { next.delete(op); removed = true; }
    }
    return removed ? { pendingOperations: next } : {};
  }),
  clearPendingOperations: () => set({ pendingOperations: new Set() }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (v) => set({ searchOpen: v }),
}));
