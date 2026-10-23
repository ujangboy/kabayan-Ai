// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import '@/i18n';
import FlashcardSession from './FlashcardSession';

vi.mock('@/services/api', () => ({
  flashcardAPI: {
    delete: vi.fn().mockResolvedValue({ data: {} }),
    review: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const cards = [{ id: 1, question: 'Ibu kota Indonesia?', answer: 'Jakarta' }];

function renderSession() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <FlashcardSession cards={cards} subjectName="Biologi" onClose={vi.fn()} />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('FlashcardSession delete card', () => {
  it('membuka dialog konfirmasi tanpa ReferenceError toast', async () => {
    renderSession();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus kartu ini' }));

    expect((await screen.findAllByText('Hapus kartu ini?')).length).toBeGreaterThan(0);
  });
});
