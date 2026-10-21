import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { extractErrorMessage } from './errors';

afterEach(async () => {
  await i18n.changeLanguage('id');
});

describe('extractErrorMessage localization', () => {
  it('uses the active language for HTTP and network errors', async () => {
    await i18n.changeLanguage('en');

    expect(extractErrorMessage({ response: { status: 404 } })).toBe('Data not found.');
    expect(extractErrorMessage({ request: {}, code: 'ERR_NETWORK' })).toBe(
      'Cannot connect to the server. Check your internet connection.',
    );

    await i18n.changeLanguage('id');

    expect(extractErrorMessage({ response: { status: 404 } })).toBe('Data tidak ditemukan.');
  });
});
