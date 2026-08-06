/**
 * Unit tests for Focus Mode store (PRD US5.2).
 *
 * Run:  npm test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useFocusStore } from './focusStore.js';

// ─── useFocusStore ───────────────────────────────────────────────────────────

describe('useFocusStore', () => {
  beforeEach(() => {
    useFocusStore.setState({ isFocusMode: false, focusActivity: null });
  });

  it('dimulai dengan state non-fokus', () => {
    const s = useFocusStore.getState();
    expect(s.isFocusMode).toBe(false);
    expect(s.focusActivity).toBeNull();
  });

  it('enterFocus mengaktifkan mode fokus beserta aktivitas', () => {
    useFocusStore.getState().enterFocus({ type: 'flashcard', to: '/flashcard', label: 'Flashcard', subjectId: 2 });
    const s = useFocusStore.getState();
    expect(s.isFocusMode).toBe(true);
    expect(s.focusActivity).toEqual({ type: 'flashcard', to: '/flashcard', label: 'Flashcard', subjectId: 2 });
  });

  it('enterFocus menoleransi null (default defensif)', () => {
    useFocusStore.getState().enterFocus(null);
    const s = useFocusStore.getState();
    expect(s.isFocusMode).toBe(true);
    expect(s.focusActivity).toBeNull();
  });

  it('exitFocus mematikan mode fokus dan mengosongkan aktivitas', () => {
    useFocusStore.getState().enterFocus({ type: 'socratic', to: '/chat', label: 'Tutor Socratic' });
    useFocusStore.getState().exitFocus();
    const s = useFocusStore.getState();
    expect(s.isFocusMode).toBe(false);
    expect(s.focusActivity).toBeNull();
  });

  it('enterFocus ulang mengganti aktivitas saat mode aktif', () => {
    const store = useFocusStore;
    store.getState().enterFocus({ type: 'flashcard', to: '/flashcard', label: 'A' });
    store.getState().enterFocus({ type: 'micro_quiz', to: '/quiz', label: 'B' });
    expect(store.getState().focusActivity).toEqual({ type: 'micro_quiz', to: '/quiz', label: 'B' });
    expect(store.getState().isFocusMode).toBe(true);
  });
});
