/**
 * Unit tests untuk Chat store — fokus pada logika undo/restore
 * (PRD 5.4 "Undo/redo untuk destructive actions").
 *
 * Run:  npm test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './index.js';

const seedChat = (id, overrides = {}) => ({
  id,
  title: `Chat ${id}`,
  messages: [],
  pinned: false,
  createdAt: new Date().toISOString(),
  tutorEnabled: false,
  tutorSubject: '',
  tutorLevel: 'intermediate',
  examSessionId: null,
  ...overrides,
});

describe('useChatStore (undo/restore)', () => {
  beforeEach(() => {
    useChatStore.setState({
      chats: [],
      currentChatId: null,
      selectedDocs: [],
      streamingChatIds: [],
      tutorBadge: null,
    });
  });

  it('restoreChat mengembalikan chat yang dihapus', () => {
    const chat = seedChat(1);
    useChatStore.setState({ chats: [chat], currentChatId: 1 });
    useChatStore.getState().deleteChat(1);

    expect(useChatStore.getState().chats).toHaveLength(0);

    useChatStore.getState().restoreChat(chat);
    const s = useChatStore.getState();
    expect(s.chats).toHaveLength(1);
    expect(s.chats[0].id).toBe(1);
    expect(s.chats[0].title).toBe('Chat 1');
  });

  it('restoreChat tidak menduplikasi chat yang sudah ada', () => {
    const chat = seedChat(1);
    useChatStore.setState({ chats: [chat] });
    useChatStore.getState().restoreChat(chat);
    expect(useChatStore.getState().chats).toHaveLength(1);
  });

  it('restoreAllChats mengembalikan seluruh daftar setelah deleteAllChats', () => {
    const chats = [seedChat(1), seedChat(2, { pinned: true })];
    useChatStore.setState({ chats, currentChatId: 1 });
    useChatStore.getState().deleteAllChats();
    expect(useChatStore.getState().chats).toHaveLength(0);

    useChatStore.getState().restoreAllChats(chats);
    const s = useChatStore.getState();
    expect(s.chats).toHaveLength(2);
    expect(s.chats.map((c) => c.id)).toEqual([1, 2]);
    expect(s.chats.find((c) => c.id === 2).pinned).toBe(true);
  });

  it('restoreAllChats tidak menimpa chat yang baru dibuat setelah hapus', () => {
    useChatStore.setState({ chats: [seedChat(1)], currentChatId: 1 });
    useChatStore.getState().deleteAllChats();
    const fresh = seedChat(9);
    useChatStore.setState({ chats: [fresh], currentChatId: 9 });

    useChatStore.getState().restoreAllChats([seedChat(1)]);
    const s = useChatStore.getState();
    expect(s.chats).toHaveLength(2);
    expect(s.chats.some((c) => c.id === 9)).toBe(true);
  });
});