// @vitest-environment jsdom
/**
 * Sidebar storage meter must read the real `/api/data/overview` shape
 * ({ uploads, trash, total }) and show the used bytes, not "0 B".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import StorageMeter from './StorageMeter';

const { mockOverview } = vi.hoisted(() => ({
  mockOverview: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  dataAPI: { overview: mockOverview },
}));

describe('StorageMeter', () => {
  beforeEach(() => {
    mockOverview.mockReset();
  });

  it('shows used storage and trash breakdown from the overview payload', async () => {
    mockOverview.mockResolvedValue({
      data: {
        storage: { uploads: 976738, trash: 1024, total: 977762 },
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <StorageMeter />
      </QueryClientProvider>
    );

    expect(await screen.findByText('954.8 KB')).toBeTruthy();
    expect(screen.getByText(/Sampah: 1\.0 KB/)).toBeTruthy();
    expect(screen.queryByText(/0 B \//)).toBeNull();
  });
});
