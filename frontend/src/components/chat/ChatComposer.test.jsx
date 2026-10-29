// @vitest-environment jsdom
/**
 * Lampiran gambar di composer (fitur vision chat):
 * preview + hapus + error inline (role=alert) + kirim dengan lampiran.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }),
}));

import ChatComposer from '@/components/chat/ChatComposer';
import '@/i18n';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function makeFile(name, type, bytes = null) {
  return new File([bytes || new Uint8Array(PNG_MAGIC)], name, { type });
}

function renderComposer(props = {}) {
  const onSend = vi.fn();
  const utils = render(<ChatComposer onSend={onSend} isStreaming={false} {...props} />);
  return { onSend, ...utils };
}

function setFile(container, file) {
  const input = container.querySelector('input[type=file]');
  fireEvent.change(input, { target: { files: [file] } });
}

async function setFileAndTick(container, file) {
  setFile(container, file);
}

describe('ChatComposer — lampiran gambar', () => {
  afterEach(cleanup);

  it('file gambar valid → muncul preview + tombol hapus', async () => {
    const { container } = renderComposer();
    setFile(container, makeFile('papan.png', 'image/png'));
    expect(screen.getByText('papan.png')).toBeTruthy();
    expect(screen.getByLabelText('Hapus lampiran')).toBeTruthy();
  });

  it('ukuran >10MB → error inline role=alert', () => {
    const { container } = renderComposer();
    const big = makeFile('besar.png', 'image/png', new Uint8Array(11 * 1024 * 1024));
    setFile(container, big);
    expect(screen.getByRole('alert').textContent).toMatch(/terlalu besar/i);
  });

  it('tipe bukan gambar → error inline role=alert', () => {
    const { container } = renderComposer();
    setFile(container, makeFile('catatan.txt', 'text/plain'));
    expect(screen.getByRole('alert').textContent).toMatch(/tidak didukung/i);
  });

  it('klik hapus → preview hilang', () => {
    const { container } = renderComposer();
    setFile(container, makeFile('papan.png', 'image/png'));
    fireEvent.click(screen.getByLabelText('Hapus lampiran'));
    expect(screen.queryByText('papan.png')).toBeNull();
  });

  it('kirim dengan lampiran & teks kosong → onSend(text, attachment)', () => {
    const { onSend, container } = renderComposer();
    setFile(container, makeFile('papan.png', 'image/png'));
    fireEvent.click(screen.getByLabelText('Kirim'));
    expect(onSend).toHaveBeenCalledTimes(1);
    const [text, attachment] = onSend.mock.calls[0];
    expect(text).toBe('');
    expect(attachment?.file?.name).toBe('papan.png');
  });

  it('tutorMode → tombol lampirkan gambar disembunyikan', () => {
    renderComposer({ tutorMode: true });
    expect(screen.queryByLabelText('Lampirkan gambar')).toBeNull();
  });
});
