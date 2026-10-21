// @vitest-environment jsdom
/**
 * The all-time token/call cards must not reuse the 24h usage payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import AiLimitTab from './AiLimitTab';

const { mockUsage, mockTutorStats } = vi.hoisted(() => ({
  mockUsage: vi.fn(),
  mockTutorStats: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  dataAPI: { usage: mockUsage },
  tutorAPI: { stats: mockTutorStats },
}));

describe('AiLimitTab', () => {
  beforeEach(() => {
    mockUsage.mockReset();
    mockTutorStats.mockReset();
  });

  it('uses the all-time usage payload for total cards and 24h for the limit', async () => {
    mockUsage.mockImplementation((period) => Promise.resolve({
      data: period === 'all'
        ? { total_tokens: 1234, total_calls: 5, features: [] }
        : {
            total_tokens: 42,
            total_calls: 1,
            features: [{ feature: 'chat', tokens: 42, calls: 1 }],
            limit: 8000,
            resets_at: new Date(Date.now() + 60_000).toISOString(),
          },
    }));
    mockTutorStats.mockResolvedValue({
      data: { total_messages: 7, helpful_count: 1, not_helpful_count: 0 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AiLimitTab />
      </QueryClientProvider>
    );

    expect(await screen.findByText('1.234')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('42 / 8.000 token')).toBeTruthy();
    expect(mockUsage).toHaveBeenCalledWith('24h');
    expect(mockUsage).toHaveBeenCalledWith('all');
  });
});
