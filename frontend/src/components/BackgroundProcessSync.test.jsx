// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import BackgroundProcessSync from './BackgroundProcessSync';
import { ToastProvider } from './Toast';
import { useAppStore } from '@/store';
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

function renderSync() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BackgroundProcessSync />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

describe('BackgroundProcessSync', () => {
  afterEach(() => {
    useJobStore.setState({ jobs: {}, completed: [], results: {} });
    useAppStore.setState({ pendingOperations: new Set() });
    mockMateri.getAll.mockResolvedValue({ data: { materials: [] } });
    mockAudio.list.mockResolvedValue({
      audio: [{ id: 2, status: 'Processing', label: 'Audio' }],
    });
    vi.restoreAllMocks();
  });

  it('syncs audio jobs without returning undefined from the query function', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderSync();

    await waitFor(() => expect(mockAudio.list).toHaveBeenCalled());
    await waitFor(() => expect(useJobStore.getState().jobs['audio-2']).toBeTruthy());

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('Query data cannot be undefined');

    unmount();
  });

  it('shows a global completion toast when a tracked audio job becomes Ready', async () => {
    mockAudio.list.mockResolvedValue({
      audio: [{ id: 2, status: 'Ready', progress: 100, error: null }],
    });
    useJobStore.setState({
      jobs: {
        'audio-2': {
          key: 'audio-2',
          type: 'audio',
          label: 'Membuat audio podcast...',
          startedAt: Date.now(),
          status: 'running',
          audioId: 2,
        },
      },
      completed: [],
      results: {},
    });

    const { unmount } = renderSync();

    await waitFor(() => expect(screen.getByText(/AI selesai:/)).toBeTruthy());
    expect(useJobStore.getState().jobs['audio-2']).toBeUndefined();
    expect(useJobStore.getState().completed).toHaveLength(0);

    unmount();
  });

  it('shows pending + completion toast for material processing', async () => {
    const processing = {
      data: {
        materials: [
          { id: 7, status: 'Processing', filename: 'uji_materi.pdf' },
        ],
      },
    };
    const ready = {
      data: {
        materials: [
          { id: 7, status: 'Ready', filename: 'uji_materi.pdf' },
        ],
      },
    };
    mockMateri.getAll
      .mockResolvedValueOnce(processing)
      .mockResolvedValue(ready);
    mockAudio.list.mockResolvedValue({ audio: [] });

    const { queryClient, unmount } = renderSync();

    await waitFor(() =>
      expect(useAppStore.getState().pendingOperations.has('process-7')).toBe(true)
    );

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['materials'] });
    });

    await waitFor(() =>
      expect(screen.getByText(/AI selesai:.*uji_materi\.pdf/)).toBeTruthy()
    );
    expect(useAppStore.getState().pendingOperations.has('process-7')).toBe(false);

    unmount();
  });

  it('completes an upload operation even when the first poll already sees Ready', async () => {
    useAppStore.setState({ pendingOperations: new Set(['process-9']) });
    mockMateri.getAll.mockResolvedValue({
      data: {
        materials: [
          { id: 9, status: 'Ready', filename: 'cepat_selesai.pdf' },
        ],
      },
    });
    mockAudio.list.mockResolvedValue({ audio: [] });

    const { unmount } = renderSync();

    await waitFor(() =>
      expect(screen.getByText(/AI selesai:.*cepat_selesai\.pdf/)).toBeTruthy()
    );
    expect(useAppStore.getState().pendingOperations.has('process-9')).toBe(false);

    unmount();
  });

  it('does not toast silent request jobs', async () => {
    useJobStore.setState({
      jobs: {
        'audio-request-2': {
          key: 'audio-request-2',
          type: 'audio',
          label: 'Membuat audio podcast...',
          startedAt: Date.now(),
          status: 'running',
        },
      },
      completed: [
        {
          key: 'audio-request-2',
          type: 'audio',
          label: 'Membuat audio podcast...',
          status: 'success',
          notify: false,
          completedAt: Date.now(),
          completedId: 'done-1',
        },
      ],
      results: {},
    });

    const { unmount } = renderSync();

    await waitFor(() => expect(useJobStore.getState().completed).toHaveLength(0));
    expect(screen.queryByText(/AI selesai:/)).toBeNull();

    unmount();
  });
});
