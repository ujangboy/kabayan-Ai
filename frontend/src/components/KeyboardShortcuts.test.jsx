// @vitest-environment jsdom
/**
 * Integration test untuk KeyboardShortcuts (PRD-01 §5.3).
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import { useAppStore } from '@/store';
import '@/i18n';

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ searchOpen: false });
});

function renderWith() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <KeyboardShortcuts />
    </MemoryRouter>
  );
}

describe('KeyboardShortcuts', () => {
  it('menekan "?" membuka modal pintasan', () => {
    renderWith();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Pintasan Keyboard')).toBeTruthy();
  });

  it('"?" kedua menutup modal', async () => {
    renderWith();
    fireEvent.keyDown(window, { key: '?' });
    fireEvent.keyDown(window, { key: '?' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('"?" tidak membuka modal saat mengetik di input', async () => {
    renderWith();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '?' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    input.remove();
  });

  it('⌘K membuka command search (via app store)', async () => {
    renderWith();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(useAppStore.getState().searchOpen).toBe(true));
  });
});