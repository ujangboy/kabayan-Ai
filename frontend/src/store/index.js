import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create(
  persist(
    (set, get) => ({
      chats: [],
      currentChatId: null,
      selectedDocs: [],

      createChat: () => {
        const chat = { id: Date.now(), title: 'Chat Baru', messages: [], pinned: false, createdAt: new Date().toISOString() };
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
          c.id === chatId ? { ...c, messages: [...c.messages, message], title: c.messages.length === 0 ? message.content.slice(0, 30) + '...' : c.title } : c
        ),
      })),

      updateLastMessage: (chatId, content) => set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, content } : m) }
            : c
        ),
      })),

      getCurrentChat: () => {
        const { chats, currentChatId } = get();
        return chats.find((c) => c.id === currentChatId);
      },

      setSelectedDocs: (docs) => set({ selectedDocs: docs }),
      clearSelectedDocs: () => set({ selectedDocs: [] }),
      // Hapus satu doc dari selectedDocs (dipanggil saat materi dihapus)
      removeSelectedDoc: (docId) => set((s) => ({
        selectedDocs: s.selectedDocs.filter((d) => d !== docId),
      })),
    }),
    { name: 'kabayan-chat-store' }
  )
);

export const useAppStore = create((set) => ({
  sidebarOpen: true,
  searchOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (v) => set({ searchOpen: v }),
}));
