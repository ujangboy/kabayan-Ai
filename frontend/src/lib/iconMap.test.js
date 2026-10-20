import { describe, expect, it } from 'vitest';
import { FALLBACK_ICON_NAME, MATERIAL_ICONS, VALID_ICON_NAMES } from './iconMap';
import { ICONS } from './icons';

function collectIconNames(value, result = new Set()) {
  if (typeof value === 'string') {
    result.add(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => collectIconNames(child, result));
  }
  return result;
}

describe('iconMap', () => {
  it('resolves every semantic icon name', () => {
    const names = collectIconNames(ICONS);
    names.add(FALLBACK_ICON_NAME);

    for (const name of names) {
      expect(VALID_ICON_NAMES.has(name), `missing icon: ${name}`).toBe(true);
    }
  });

  it('stores path data instead of bundling every weight variant', () => {
    for (const [name, entry] of Object.entries(MATERIAL_ICONS)) {
      expect(typeof entry.regular, `${name} regular path`).toBe('string');
      expect(entry.regular.length, `${name} regular path length`).toBeGreaterThan(0);
      if (entry.filled != null) {
        expect(typeof entry.filled, `${name} filled path`).toBe('string');
        expect(entry.filled.length, `${name} filled path length`).toBeGreaterThan(0);
      }
    }
  });
});
