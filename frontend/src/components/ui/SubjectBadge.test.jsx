// @vitest-environment jsdom
/**
 * Fase C — warna kartu per mata kuliah harus deterministik dari subject_id
 * (identik di semua halaman), frontend-only, 5 palet.
 */
import { describe, it, expect } from 'vitest';
import { getSubjectPalette, getSubjectPaletteIndex, getSubjectColorIndex } from '@/components/ui/SubjectBadge';

describe('getSubjectPalette — warna per subject_id', () => {
  it('5 palet, index = (id - 1) % 5', () => {
    expect(getSubjectPaletteIndex({ subjectId: 1 })).toBe(0);
    expect(getSubjectPaletteIndex({ subjectId: 2 })).toBe(1);
    expect(getSubjectPaletteIndex({ subjectId: 6 })).toBe(0); // siklus
    expect(getSubjectPaletteIndex({ subjectId: 7 })).toBe(1);
  });

  it('subjek yang sama selalu palet yang sama (konsisten antar halaman)', () => {
    const a = getSubjectPalette(3);
    const b = getSubjectPalette(3);
    expect(a).toBe(b);
    expect(a.id).toBe('purple');
  });

  it('tanpa subject_id → fallback hash nama yang stabil', () => {
    const i1 = getSubjectColorIndex('Biologi Sel');
    const i2 = getSubjectColorIndex('Biologi Sel');
    expect(i1).toBe(i2);
    expect(getSubjectPaletteIndex({ tone: 3, name: 'x' })).toBe(3);
  });

  it('id tidak valid → null (bukan crash)', () => {
    expect(getSubjectPalette(undefined)).toBeNull();
    expect(getSubjectPalette(0)).toBeNull();
    expect(getSubjectPalette('abc')).toBeNull();
  });
});
