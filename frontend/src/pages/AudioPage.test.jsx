// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
});
