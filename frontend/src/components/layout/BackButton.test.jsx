// @vitest-environment jsdom
/**
 * Integration test untuk BackButton (PRD-01 §6.2).
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BackButton from '@/components/layout/BackButton';
import '@/i18n';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function renderWith(initialEntries) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      <BackButton />
    </MemoryRouter>
  );
}

describe('BackButton', () => {
  afterEach(cleanup);

  it('deep page → label dinamis route induk + navigasi ke parent', () => {
    renderWith(['/subjects/123']);
    expect(screen.getByRole('button').textContent).toContain('Kembali ke Mata Kuliah');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects');
  });

  it('?from= diprioritaskan dan label mengikuti tujuan from', () => {
    renderWith(['/subjects/123?from=/materi']);
    expect(screen.getByRole('button').textContent).toContain('Kembali ke Materi');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('loc').textContent).toBe('/materi');
  });

  it('halaman tanpa tujuan back yang bermakna → tombol disembunyikan', () => {
    renderWith(['/materi']);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('label kustom selalu ditampilkan walau tidak ada tujuan back', () => {
    render(
      <MemoryRouter initialEntries={['/materi']}>
        <BackButton label="Batal" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button').textContent).toContain('Batal');
  });
});