// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@/i18n';
import QuizView from './QuizView';
import { useJobStore } from '@/store/jobStore';

const { submit, detail } = vi.hoisted(() => ({
  submit: vi.fn().mockResolvedValue({ data: { score: 0 } }),
  detail: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  examAPI: { submit },
  sessionsAPI: { detail },
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
    expect(submit).toHaveBeenCalledWith(42, {}, expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('keeps evaluation running and restores its result after the quiz unmounts', async () => {
    let resolveSubmit;
    submit.mockReset().mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve; })
    );
    detail.mockResolvedValue({ data: { evaluation: { score: 85 }, answers: {} } });
    const key = 'exam-submit-42';
    useJobStore.getState().removeJob(key);
    useJobStore.getState().clearResult(key);
    const firstView = render(
      <QuizView
        sessionData={session}
        clockStart={Date.now() - 120_000}
        onDone={vi.fn()}
      />
    );

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(useJobStore.getState().jobs[key]).toBeDefined();
    firstView.unmount();

    const onDone = vi.fn();
    const returnedView = render(
      <QuizView sessionData={{ ...session, evaluating: true }} onDone={onDone} />
    );
    expect(returnedView.container.querySelector('[role="status"]')).not.toBeNull();

    resolveSubmit({ data: { score: 85 } });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ score: 85 }, {}));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
