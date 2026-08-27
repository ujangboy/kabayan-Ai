// @vitest-environment jsdom
/**
 * Smoke test StudyInsights (R7) — pastikan komponen render tanpa crash
 * dan menampilkan tile hasil dari endpoint /study/*.
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n'; // inisialisasi i18n dengan resource nyata
import StudyInsights from './StudyInsights';

const { mockStudy } = vi.hoisted(() => ({
  mockStudy: {
    metrics: vi.fn().mockResolvedValue({
      fsrs_overview: { due_cards: 3, new_cards: 2, retention_pct: 90 },
    }),
    progress: vi.fn().mockResolvedValue({ streak: { days: 5 }, mastery_trend: [] }),
    dailyPlan: vi.fn().mockResolvedValue({
      items: [{ title: 'Sesi A' }],
      total_duration_minutes: 30,
      best_hour: 9,
    }),
    diagnostic: vi.fn().mockResolvedValue({ readiness: 0.8, overview: { coverage_pct: 70 } }),
    knowledgeGraph: vi.fn().mockResolvedValue({
      meta: { topics_count: 4, weak_topics_count: 1 },
    }),
  },
}));

vi.mock('@/services/api', () => ({ studyAPI: mockStudy }));

const renderWith = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StudyInsights />
    </QueryClientProvider>
  );

describe('StudyInsights smoke', () => {
  it('renders insight tiles from study endpoints', async () => {
    renderWith();
    // judul section (terjemahan id: "Wawasan Belajar")
    expect(await screen.findByText(/Wawasan Belajar/i)).toBeTruthy();
    // label tile FSRS muncul setelah data resolve
    await waitFor(() => {
      expect(screen.getByText(/Kartu jatuh tempo/i)).toBeTruthy();
    });
  });
});
