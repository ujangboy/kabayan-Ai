// @vitest-environment jsdom
/**
 * Regression test bug "save note → klik Lihat":
 * 1) Toast harus menavigasi ke /notebook dengan note_id (bukan /notes).
 * 2) Tanpa note_id, tombol Lihat tidak dirender.
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ChatNoteToast from '@/components/chat/ChatNoteToast';
import '@/i18n';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname + loc.search}</span>;
}

function renderWith(noteToast) {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <LocationProbe />
      <ChatNoteToast noteToast={noteToast} />
    </MemoryRouter>
  );
}

describe('ChatNoteToast — bug save note & klik Lihat', () => {
  afterEach(cleanup);

  it('klik Lihat membuka /notebook?note_id=<id>', () => {
    renderWith({ message: 'Tersimpan ke Notebook', note_id: 42 });
    const btn = screen.getByText('Lihat');
    fireEvent.click(btn);
    expect(screen.getByTestId('loc').textContent).toBe('/notebook?note_id=42');
  });

  it('tanpa note_id → tombol Lihat disembunyikan', () => {
    renderWith({ message: 'Gagal menyimpan catatan.', note_id: null });
    expect(screen.queryByText('Lihat')).toBeNull();
  });

  it('label tombol memakai terjemahan aktif (id: Lihat)', () => {
    renderWith({ message: 'Tersimpan ke Notebook', note_id: 7 });
    expect(screen.getByText('Lihat')).toBeTruthy();
  });
});
