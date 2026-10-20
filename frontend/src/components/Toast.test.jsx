// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import '../i18n';

function Trigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.confirm({
        title: 'Hapus catatan?',
        message: 'Tindakan ini tidak bisa dibatalkan.',
        confirmLabel: 'Hapus',
        cancelLabel: 'Batal',
        onConfirm: async () => {},
      })}
    >
      Buka konfirmasi
    </button>
  );
}

describe('ConfirmDialog accessibility', () => {
  it('memakai role dialog, fokus awal, Escape, dan mengembalikan fokus', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Buka konfirmasi' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog.textContent).toContain('Hapus catatan?');
    expect(dialog.textContent).toContain('Tindakan ini tidak bisa dibatalkan.');

    const cancel = screen.getByRole('button', { name: 'Batal' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
