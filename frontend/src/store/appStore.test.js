// @vitest-environment jsdom
/**
 * Unit tests untuk useAppStore — navigation state (PRD-01 §4.1).
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index.js';

describe('useAppStore (navigation state)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      lastRoute: null,
      searchOpen: false,
      shortcutsOpen: false,
      sidebarOpen: true,
    });
  });

  it('setLastRoute mencatat rute terakhir yang dikunjungi', () => {
    expect(useAppStore.getState().lastRoute).toBeNull();
    useAppStore.getState().setLastRoute('/subjects/123');
    expect(useAppStore.getState().lastRoute).toBe('/subjects/123');
    useAppStore.getState().setLastRoute('/materi');
    expect(useAppStore.getState().lastRoute).toBe('/materi');
  });

  it('setShortcutsOpen mengontrol modal pintasan keyboard', () => {
    useAppStore.getState().setShortcutsOpen(true);
    expect(useAppStore.getState().shortcutsOpen).toBe(true);
    useAppStore.getState().setShortcutsOpen(false);
    expect(useAppStore.getState().shortcutsOpen).toBe(false);
  });
});