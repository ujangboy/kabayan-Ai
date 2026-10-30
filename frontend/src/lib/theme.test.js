// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyTheme, getThemeId, toggleDefaultTheme } from './theme';
import { THEMES } from './themes';

// Setiap test mulai bersih: DOM + storage, dan matchMedia di-mock agar
// fallback getThemeId deterministik (jsdom tidak menyediakannya).
let matchMediaMock;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  matchMediaMock = vi.fn().mockReturnValue({ matches: false });
  window.matchMedia = matchMediaMock;
});
afterEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
});

// Semua tema valid + tak ada tema gelap tanpa class .dark setelah apply.
describe('applyTheme', () => {
  it('menerapkan data-theme, class .dark dan colorScheme sesuai mode', () => {
    for (const t of THEMES) {
      const picked = applyTheme(t.id);
      expect(picked).toBe(t.id);
      expect(document.documentElement.getAttribute('data-theme')).toBe(t.id);
      expect(document.documentElement.classList.contains('dark')).toBe(t.mode === 'dark');
      expect(document.documentElement.style.colorScheme).toBe(t.mode);
      expect(localStorage.getItem('appTheme')).toBe(t.id);
      expect(localStorage.getItem('appThemeMode')).toBe(t.mode);
    }
  });

  it('gagal untuk id tak dikenal — tidak merusak state', () => {
    applyTheme('dracula');
    expect(applyTheme('hacker-green')).toBe('dracula');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula');
  });
});

describe('getThemeId', () => {
  it('membaca data-theme dari DOM', () => {
    applyTheme('nord');
    expect(getThemeId()).toBe('nord');
  });

  it('migrasi key legacy theme=light/dark', () => {
    localStorage.setItem('theme', 'light');
    expect(getThemeId()).toBe('kabayan-light');
    localStorage.setItem('theme', 'dark');
    expect(getThemeId()).toBe('kabayan-dark');
  });

  it('id invalid di storage → fallback matchMedia', () => {
    localStorage.setItem('appTheme', 'hacker-green');
    expect(getThemeId()).toBe('kabayan-dark');
  });
});

describe('toggleDefaultTheme', () => {
  it('bolak-balik antar tema default saja', () => {
    applyTheme('gruvbox-dark');
    expect(toggleDefaultTheme()).toBe('kabayan-light');
    expect(toggleDefaultTheme()).toBe('kabayan-dark');
  });
});
