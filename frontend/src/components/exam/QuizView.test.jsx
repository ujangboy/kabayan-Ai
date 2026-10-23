// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@/i18n';
import QuizView from './QuizView';

const { submit } = vi.hoisted(() => ({
  submit: vi.fn().mockResolvedValue({ data: { score: 0 } }),
}));

vi.mock('@/services/api', () => ({
  examAPI: { submit },
  materiAPI: {},
}));

const session = {
  session_id: 42,
  duration_minutes: 1,
  questions: [
    {
      id: 1,
      type: 'mcq',
      question: 'Ibu kota Indonesia?',
      options: { A: 'Jakarta', B: 'Bandung' },
      answer: 'A',
    },
  ],
};

describe('QuizView timer auto-submit', () => {
  it('mengirim jawaban kosong tepat satu kali saat waktu habis', async () => {
    const onDone = vi.fn();
    render(
      <StrictMode>
        <QuizView
          sessionData={session}
          clockStart={Date.now() - 120_000}
          onDone={onDone}
        />
      </StrictMode>
    );

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith(42, {});
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});
