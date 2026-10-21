// @vitest-environment jsdom
/**
 * Language changes must also update <html lang> for screen readers.
 */
import { describe, it, expect, afterEach } from 'vitest';
import i18n, { setAppLanguage } from './index';

describe('i18n document language', () => {
  afterEach(async () => {
    await setAppLanguage('id');
    localStorage.removeItem('kabayan-language');
  });

  it('keeps <html lang> in sync with the active language', async () => {
    await setAppLanguage('en');
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    await setAppLanguage('su');
    expect(document.documentElement.lang).toBe('su');

    await setAppLanguage('tidak-dikenal');
    expect(document.documentElement.lang).toBe('id');
  });
});
