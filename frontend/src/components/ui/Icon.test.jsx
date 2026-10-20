// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FALLBACK_ICON, MATERIAL_ICONS } from '@/lib/iconMap';
import { Icon } from './Icon';

function pathOf(container) {
  return container.querySelector('svg path')?.getAttribute('d');
}

describe('Icon', () => {
  it('renders the semantic glyph and exposes an accessible name', () => {
    const { container } = render(<Icon name="search" ariaLabel="Cari" />);

    const svg = screen.getByRole('img', { name: 'Cari' });
    expect(svg.getAttribute('data-icon')).toBe('search');
    expect(pathOf(container)).toBe(MATERIAL_ICONS.search.regular);
  });

  it('switches to the filled path when requested', () => {
    const { container, rerender } = render(<Icon name="push_pin" />);
    expect(pathOf(container)).toBe(MATERIAL_ICONS.push_pin.regular);

    rerender(<Icon name="push_pin" fill={1} />);
    expect(pathOf(container)).toBe(MATERIAL_ICONS.push_pin.filled);
    expect(container.querySelector('svg').getAttribute('data-fill')).toBe('1');
  });

  it('falls back to the help glyph for unknown names', () => {
    const { container } = render(<Icon name="does_not_exist" />);
    expect(pathOf(container)).toBe(FALLBACK_ICON);
  });
});
