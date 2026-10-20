// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BackgroundProcessSync from './BackgroundProcessSync';
import { useJobStore } from '@/store/jobStore';

const { mockMateri, mockAudio } = vi.hoisted(() => ({
  mockMateri: {
    getAll: vi.fn().mockResolvedValue({ data: { materials: [] } }),
  },
  mockAudio: {
    list: vi.fn().mockResolvedValue({
      audio: [{ id: 2, status: 'Processing', label: 'Audio' }],
    }),
  },
}));

vi.mock('@/services/api', () => ({
  materiAPI: mockMateri,
  audioAPI: mockAudio,
}));

describe('BackgroundProcessSync', () => {
  afterEach(() => {
    useJobStore.setState({ jobs: {} });
    vi.restoreAllMocks();
  });

  it('syncs audio jobs without returning undefined from the query function', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <BackgroundProcessSync />
      </QueryClientProvider>
    );

    await waitFor(() => expect(mockAudio.list).toHaveBeenCalled());
    await waitFor(() => expect(useJobStore.getState().jobs['audio-2']).toBeTruthy());

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('Query data cannot be undefined');

    unmount();
  });
});
