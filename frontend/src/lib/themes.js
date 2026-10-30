// Registry 10 tema ala OpenCode — pasangan dgn blok CSS
// `html[data-theme='<id>']` di index.css. Warna preview dipakai kartu di
// Settings; NAMA tema = proper noun, tidak lewat i18n.
export const THEMES = [
  { id: 'kabayan-light', label: 'Kabayan Terang', mode: 'light',
    preview: { bg: '#f7f9f5', surface: '#ffffff', accent: '#0d7a58', text: '#14221d' } },
  { id: 'kabayan-dark', label: 'Kabayan Gelap', mode: 'dark',
    preview: { bg: '#101815', surface: '#18231e', accent: '#33bb89', text: '#ecf5f0' } },
  { id: 'tokyo-night', label: 'Tokyo Night', mode: 'dark',
    preview: { bg: '#1a1b26', surface: '#24283b', accent: '#7aa2f7', text: '#c0caf5' } },
  { id: 'dracula', label: 'Dracula', mode: 'dark',
    preview: { bg: '#282a36', surface: '#343746', accent: '#bd93f9', text: '#f8f8f2' } },
  { id: 'nord', label: 'Nord', mode: 'dark',
    preview: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', text: '#eceff4' } },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', mode: 'dark',
    preview: { bg: '#282828', surface: '#3c3836', accent: '#fe8019', text: '#ebdbb2' } },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', mode: 'light',
    preview: { bg: '#eff1f5', surface: '#fafcfe', accent: '#8839ef', text: '#4c4f69' } },
  { id: 'github-light', label: 'GitHub Light', mode: 'light',
    preview: { bg: '#ffffff', surface: '#f6f8fa', accent: '#0969da', text: '#1f2328' } },
  { id: 'one-light', label: 'One Light', mode: 'light',
    preview: { bg: '#fafafa', surface: '#ffffff', accent: '#4078f2', text: '#383a42' } },
  { id: 'solarized-light', label: 'Solarized Light', mode: 'light',
    preview: { bg: '#fdf6e3', surface: '#fefcf3', accent: '#268bd2', text: '#586e75' } },
];

export const DEFAULT_THEME = 'kabayan-dark';

export function findTheme(id) {
  return THEMES.find((t) => t.id === id) || null;
}
