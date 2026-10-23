/**
 * Fase D — tanggal per-hari rencana belajar:
 * start_date harus diparse sebagai tanggal LOKAL (bukan UTC) dan
 * formatItemDate(start, n) = start + n hari.
 */
import { describe, it, expect } from 'vitest';
import { formatItemDate, formatDayShort } from '@/components/studyplan/shared';

describe('formatItemDate / formatDayShort — jadwal per hari', () => {
  it('date-only "2026-10-23" diparse lokal + offset hari', () => {
    // 23 Okt 2026 + 6 hari = 29 Okt 2026
    const d = formatItemDate('2026-10-23', 6);
    expect(d).toContain('29');
    expect(d).toContain('Okt');
    expect(formatDayShort('2026-10-23', 0)).toContain('23');
  });

  it('day 0 = tanggal mulai itu sendiri', () => {
    expect(formatItemDate('2026-10-23', 0)).toContain('23');
  });

  it('string tidak valid → string kosong (bukan Invalid Date)', () => {
    expect(formatItemDate('bukan-tanggal', 3)).toBe('');
    expect(formatDayShort(null, 0)).toBe('');
  });
});
