// Sumber kebenaran tema = DOM (data-theme + class .dark), dipersist ke
// localStorage 'appTheme'/'appThemeMode'. Module UI (ThemeToggle, Settings)
// subscribes via event 'kabayan-theme' atau hook useThemeId.
import { useEffect, useState } from 'react';
import { findTheme, DEFAULT_THEME } from './themes';

const KEYS = { id: 'appTheme', mode: 'appThemeMode' };

// Migration: key legacy 'theme' (light/dark) dari ThemeToggle lama.
function readStoredId() {
  try {
    const id = localStorage.getItem(KEYS.id);
    if (findTheme(id)) return id;
    const legacy = localStorage.getItem('theme');
    if (legacy === 'light' || legacy === 'dark') {
      return legacy === 'light' ? 'kabayan-light' : 'kabayan-dark';
    }
  } catch (e) { /* storage bisa diblok — pakai default */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'kabayan-light';
  } catch (e) { /* jsdom / lingkungan tanpa matchMedia */ }
  return DEFAULT_THEME;
}

export function getThemeId() {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (findTheme(attr)) return attr;
  } catch (e) { /* no DOM (SSR/test) — lanjut ke storage */ }
  return readStoredId();
}

// Meta theme-color (tint bar browser mobile) ikut warna bg tema aktif.
export function syncMetaTheme() {
  const theme = findTheme(getThemeId()) || findTheme(DEFAULT_THEME);
  if (!theme) return;
  try {
    let metas = [...document.querySelectorAll('meta[name="theme-color"]')];
    if (metas.length === 0) {
      const m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      document.head.appendChild(m);
      metas = [m];
    }
    for (const m of metas) {
      m.setAttribute('content', theme.preview.bg);
      m.removeAttribute('media');
    }
  } catch (e) { /* lingkungan tanpa DOM utuh — skip */ }
}

export function applyTheme(id) {
  const theme = findTheme(id);
  if (!theme) return getThemeId();
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.colorScheme = theme.mode;
  try {
    localStorage.setItem(KEYS.id, theme.id);
    localStorage.setItem(KEYS.mode, theme.mode);
  } catch (e) { /* ignore */ }
  syncMetaTheme();
  window.dispatchEvent(new CustomEvent('kabayan-theme'));
  return theme.id;
}

// ThemeToggle: bolak-balik tema default terang/gelar (tema custom
// kembali lewat Settings → Tampilan).
export function toggleDefaultTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  return applyTheme(isDark ? 'kabayan-light' : 'kabayan-dark');
}

export function useThemeId() {
  const [id, setId] = useState(() => document.documentElement.getAttribute('data-theme'));
  useEffect(() => {
    const sync = () => setId(document.documentElement.getAttribute('data-theme'));
    window.addEventListener('kabayan-theme', sync);
    return () => window.removeEventListener('kabayan-theme', sync);
  }, []);
  return id;
}
