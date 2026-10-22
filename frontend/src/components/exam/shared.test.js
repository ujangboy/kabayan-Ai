import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  averageSessionScore,
  buildRetryBlueprint,
  deriveBlueprintItems,
  getExamTypeLabel,
  unwrapJobPayload,
} from './shared';

afterEach(async () => {
  await i18n.changeLanguage('id');
});

describe('getExamTypeLabel', () => {
  it('localizes stored and normalized exam type values', async () => {
    const t = i18n.t.bind(i18n);

    await i18n.changeLanguage('en');
    expect(getExamTypeLabel(t, 'Latihan Harian')).toBe('Daily Practice');
    expect(getExamTypeLabel(t, 'latihan_harian')).toBe('Daily Practice');
    expect(getExamTypeLabel(t, 'UTS')).toBe('Midterm');
    expect(getExamTypeLabel(t, 'quiz')).toBe('Quiz');

    await i18n.changeLanguage('id');
    expect(getExamTypeLabel(t, 'Latihan Harian')).toBe('Latihan Harian');
    expect(getExamTypeLabel(t, 'latihan_harian')).toBe('Latihan Harian');
    expect(getExamTypeLabel(t, 'UTS')).toBe('UTS');
  });

  it('falls back to the original label for unknown types', async () => {
    await i18n.changeLanguage('en');
    expect(getExamTypeLabel(i18n.t.bind(i18n), 'midterm_oral')).toBe('MIDTERM ORAL');
  });
});

describe('averageSessionScore', () => {
  it('ignores sessions that have not been scored', () => {
    expect(
      averageSessionScore([
        { best_score: 100 },
        { best_score: 50 },
        { best_score: null },
        { best_score: undefined },
      ])
    ).toBe(75);
  });

  it('returns zero when no session has a score', () => {
    expect(averageSessionScore([{ best_score: null }])).toBe(0);
    expect(averageSessionScore([])).toBe(0);
  });
});

describe('deriveBlueprintItems / buildRetryBlueprint', () => {
  const questions = [
    { topic: 'Sel', type: 'mcq' },
    { topic: 'Sel', question_type: 'essay' },
    { topic: 'Genetika', type: 'short_answer' },
  ];

  it('reads question type from both API field names', () => {
    const items = deriveBlueprintItems(questions);
    expect(items).toHaveLength(2);
    expect(items[0].question_types.sort()).toEqual(['essay', 'mcq']);
    expect(items[1].question_types).toEqual(['short_answer']);
  });

  it('builds retry preview from the detail `questions` payload', () => {
    const blueprint = buildRetryBlueprint(
      { blueprint_id: 5, title: 'Sesi lama' },
      { title: 'Sesi baru', questions }
    );
    expect(blueprint.blueprint_id).toBe(5);
    expect(blueprint.title).toBe('Sesi baru');
    expect(blueprint.blueprint_items).toHaveLength(2);
  });

  it('supports legacy questions_json payload', () => {
    const blueprint = buildRetryBlueprint(
      { blueprint_id: 5, title: 'Sesi' },
      { questions_json: [{ topic: 'Sel', question_type: 'mcq' }] }
    );
    expect(blueprint.blueprint_items[0].question_types).toEqual(['mcq']);
  });
});

describe('unwrapJobPayload', () => {
  it('unwraps an axios response stored by a background job', () => {
    const payload = { blueprint_id: 4, blueprint_items: [] };
    expect(unwrapJobPayload({ data: payload, status: 200 })).toBe(payload);
  });

  it('keeps plain payloads unchanged', () => {
    const payload = { session_id: 9 };
    expect(unwrapJobPayload(payload)).toBe(payload);
  });
});
