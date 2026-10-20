// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import '@/i18n';
import { ToastProvider } from '@/components/Toast';
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

describe('AudioPage', () => {
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
});
