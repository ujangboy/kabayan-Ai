import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { getExamTypeLabel } from './shared';

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
