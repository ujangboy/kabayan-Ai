// @vitest-environment jsdom
/**
 * Smoke test — memastikan setiap halaman bisa di-render tanpa crash.
 * Reproduksi untuk error "semua halaman tidak bisa tampil".
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import { TooltipProvider } from '@/components/ui/Tooltip';

vi.mock('@/services/api', () => ({
  profileAPI: { get: vi.fn().mockResolvedValue({ data: { language: 'id' } }) },
}));

const ROUTES = [
  ['/dashboard', 'Dashboard'],
  ['/chat', 'Chat AI'],
  ['/subjects', 'Mata Kuliah'],
  ['/materi', 'Materi'],
  ['/notebook', 'Notebook'],
  ['/flashcard', 'Flashcard'],
  ['/quiz', 'Quiz'],
  ['/exam-analyzer', 'Ujian Simulasi'],
  ['/study-plan', 'Rencana Belajar'],
  ['/settings', 'Pengaturan'],
];

describe('App smoke render', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it.each(ROUTES)('render %s tanpa error', async (path, title) => {
    window.history.pushState({}, '', path);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.queryByText(/error/i)).toBeNull(), { timeout: 3000 });
  });
});