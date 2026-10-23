// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import '@/i18n';
import { ToastProvider } from '@/components/Toast';
import { useUiStore } from '@/store';
import AudioPage from './AudioPage';

const { mockAudio, mockMateri, mockSubjects } = vi.hoisted(() => ({
  mockAudio: { list: vi.fn().mockResolvedValue({ audio: [] }) },
  mockMateri: { getAll: vi.fn().mockResolvedValue({ data: { materials: [] } }) },
  mockSubjects: { getAll: vi.fn().mockResolvedValue({ data: { subjects: [] } }) },
}));

vi.mock('@/services/api', () => ({
  audioAPI: mockAudio,
  materiAPI: mockMateri,
  subjectAPI: mockSubjects,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe('AudioPage', () => {
  beforeEach(() => {
    useUiStore.setState({ subjectFilterAudio: '' });
    mockAudio.list.mockResolvedValue({ audio: [] });
    mockMateri.getAll.mockResolvedValue({ data: { materials: [] } });
    mockSubjects.getAll.mockResolvedValue({ data: { subjects: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses the audio list payload directly', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ToastProvider>
            <AudioPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(mockAudio.list).toHaveBeenCalled());

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('Query data cannot be undefined');
  });

  it('preserves subject_id and material_id when hydrating a deep link', async () => {
    useUiStore.setState({ subjectFilterAudio: '' });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/audio?subject_id=2&material_id=13']}>
          <ToastProvider>
            <AudioPage />
            <LocationProbe />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent;
      expect(search).toContain('subject_id=2');
      expect(search).toContain('material_id=13');
    });
    expect(useUiStore.getState().subjectFilterAudio).toBe('2');
  });

  it('sorts audio newest by default and oldest on demand', async () => {
    mockAudio.list.mockResolvedValue({
      audio: [
        { id: 11, material_id: 5, voice: 'id-ID-GadisNeural', status: 'Ready', created_at: '2026-01-02T10:00:00Z' },
        { id: 12, material_id: 6, voice: 'id-ID-ArdiNeural', status: 'Ready', created_at: '2026-01-01T10:00:00Z' },
      ],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ToastProvider>
            <AudioPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const items = await screen.findAllByTestId('audio-item');
    expect(within(items[0]).getByText('Gadis · Wanita')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Terbaru'), { target: { value: 'oldest' } });

    await waitFor(() => {
      const sorted = screen.getAllByTestId('audio-item');
      expect(within(sorted[0]).getByText('Ardi · Pria')).toBeTruthy();
    });
  });

  it('offers regenerate and delete for cancelled audio without a dead player', async () => {
    mockAudio.list.mockResolvedValue({
      audio: [
        { id: 2, material_id: 5, voice: 'id-ID-ArdiNeural', status: 'Cancelled', created_at: '2026-01-01T10:00:00Z' },
      ],
    });

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ToastProvider>
            <AudioPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const item = await screen.findByTestId('audio-item');
    expect(within(item).getByText('Dibatalkan')).toBeTruthy();
    expect(within(item).getByRole('button', { name: 'Buat ulang' })).toBeTruthy();
    expect(within(item).getByRole('button', { name: 'Hapus audio' })).toBeTruthy();
    // Audio Cancelled tidak punya file — jangan tampilkan player yang mati.
    expect(container.querySelector('audio')).toBeNull();
  });

  it('explains an empty subject filter and clears it', async () => {
    mockSubjects.getAll.mockResolvedValue({
      data: { subjects: [{ id: 2, name: 'Biologi' }] },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/audio?subject_id=2']}>
          <ToastProvider>
            <AudioPage />
            <LocationProbe />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Belum ada audio untuk mata kuliah/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Semua' }));

    await waitFor(() => {
      expect(useUiStore.getState().subjectFilterAudio).toBe('');
      expect(screen.getByTestId('location-search').textContent).not.toContain('subject_id');
    });
    expect(await screen.findByText('Belum ada audio yang dibuat.')).toBeTruthy();
  });

  it('defaults to all subjects on a fresh mount without a deep link', async () => {
    useUiStore.setState({ subjectFilterAudio: '1' });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/audio']}>
          <ToastProvider>
            <AudioPage />
            <LocationProbe />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(useUiStore.getState().subjectFilterAudio).toBe('');
      expect(screen.getByTestId('location-search').textContent).not.toContain('subject_id');
    });
  });
});
