// @vitest-environment jsdom
/**
 * Breadcrumb subject name must update when the dashboard query resolves.
 * Regression: reading queryClient.getQueryData() during render left the crumb
 * stuck on "Memuat..." because the component never subscribed to the query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import Breadcrumbs from './Breadcrumbs';

const { mockGetDashboard } = vi.hoisted(() => ({
  mockGetDashboard: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  subjectAPI: { getDashboard: mockGetDashboard },
}));

describe('Breadcrumbs', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
  });

  it('replaces the loading label with the resolved subject name', async () => {
    mockGetDashboard.mockResolvedValue({
      data: { subject: { id: 1, name: 'algoritma' } },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/subjects/1']}>
          <Breadcrumbs />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('algoritma')).toBeTruthy();
    expect(screen.queryByText(/Memuat|Loading/i)).toBeNull();
  });
});
