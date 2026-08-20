// @vitest-environment jsdom
/**
 * Unit tests untuk useBackNavigation (PRD-01 §5.2).
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useBackNavigation } from './useBackNavigation.js';

afterEach(cleanup);

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="loc">{pathname + search}</span>;
}

function Harness({ fallback }) {
  const { back, canGoBack } = useBackNavigation({ fallback });
  return (
    <>
      <button onClick={back} data-testid="back">
        back
      </button>
      <span data-testid="can">{String(canGoBack)}</span>
    </>
  );
}

function renderWith(ui, initialEntries = ['/subjects/123']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      {ui}
    </MemoryRouter>
  );
}

const setReferrer = (url) => {
  Object.defineProperty(document, 'referrer', { value: url, configurable: true });
};

describe('useBackNavigation', () => {
  beforeEach(() => setReferrer(''));

  it('tanpa from/referrer → navigasi ke route induk', () => {
    renderWith(<Harness />, ['/subjects/123']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects');
  });

  it('param ?from= diprioritaskan di atas route induk', () => {
    renderWith(<Harness />, ['/subjects/123?from=/materi']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/materi');
  });

  it('referrer same-origin dipakai bila tidak ada ?from', () => {
    setReferrer('http://localhost:3000/flashcard/review');
    renderWith(<Harness />, ['/subjects/123']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/flashcard/review');
  });

  it('referrer cross-origin diabaikan (lanjut ke parent/fallback)', () => {
    setReferrer('https://example.com/other');
    renderWith(<Harness />, ['/subjects/123']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects');
  });

  it('referrer sama dengan halaman saat ini diabaikan', () => {
    setReferrer('http://localhost:3000/subjects/123');
    renderWith(<Harness />, ['/subjects/123']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects');
  });

  it('route tanpa induk → fallback /dashboard', () => {
    renderWith(<Harness />, ['/materi']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/dashboard');
  });

  it('fallback kustom dipakai bila tidak ada tujuan lain', () => {
    renderWith(<Harness fallback="/subjects" />, ['/materi']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects');
  });

  it('canGoBack=true saat ada parent/from/referrer, false saat hanya fallback', () => {
    const { unmount } = renderWith(<Harness />, ['/subjects/123']);
    expect(screen.getByTestId('can').textContent).toBe('true');
    unmount();

    renderWith(<Harness />, ['/materi']);
    expect(screen.getByTestId('can').textContent).toBe('false');
  });

  it('parent bertingkat: /subjects/123/materials → /subjects/123', () => {
    renderWith(<Harness />, ['/subjects/123/materials']);
    fireEvent.click(screen.getByTestId('back'));
    expect(screen.getByTestId('loc').textContent).toBe('/subjects/123');
  });
});