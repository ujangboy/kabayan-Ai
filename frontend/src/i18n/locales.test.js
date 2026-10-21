import { describe, expect, it } from 'vitest';
import id from './locales/id.json';
import en from './locales/en.json';
import su from './locales/su.json';

function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, path);
    }
    return [path];
  });
}

describe('locale parity', () => {
  it('keeps id, en, and su translation keys in sync', () => {
    const idKeys = flattenKeys(id).sort();
    const enKeys = flattenKeys(en).sort();
    const suKeys = flattenKeys(su).sort();

    expect(enKeys).toEqual(idKeys);
    expect(suKeys).toEqual(idKeys);
  });
});
