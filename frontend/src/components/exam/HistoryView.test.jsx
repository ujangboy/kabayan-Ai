// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import '@/i18n';
import HistoryView from './HistoryView';

vi.mock('@/services/api', () => ({
  subjectAPI: {
    delete: vi.fn().mockResolvedValue({ data: {} }),
    getUsage: vi.fn().mockResolvedValue({ data: { counts: {} } }),
  },
  sessionsAPI: {
    list: vi.fn().mockResolvedValue({ data: { sessions: [] } }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  materiAPI: {
    getAll: vi.fn().mockResolvedValue({ data: { materials: [] } }),
  },
}));

function renderPicker() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ToastProvider>
            <HistoryView
              subjectId=""
              subjects={[{ id: 1, name: 'Biologi' }]}
              onSelectSubject={vi.fn()}
              onStartConfig={vi.fn()}
            />
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('HistoryView subject picker', () => {
  it('render tanpa subject terpilih tanpa ReferenceError useNavigate', async () => {
    renderPicker();

    expect(await screen.findByText('Pilih Mata Kuliah')).toBeTruthy();
    expect(screen.getByText('Biologi')).toBeTruthy();
  });
});
