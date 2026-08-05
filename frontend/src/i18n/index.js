import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id from './locales/id.json';
import en from './locales/en.json';
import su from './locales/su.json';

const STORAGE_KEY = 'kabayan-language';

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['id', 'en', 'su'].includes(stored)) return stored;
  } catch {
    /* localStorage tidak tersedia — pakai default */
  }
  return 'id';
}

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
    su: { translation: su },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
});

export function getAppLanguage() {
  return i18n.language && ['id', 'en', 'su'].includes(i18n.language) ? i18n.language : 'id';
}

export function setAppLanguage(lang) {
  const normalized = ['id', 'en', 'su'].includes(lang) ? lang : 'id';
  i18n.changeLanguage(normalized);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* abaikan */
  }
}

export { STORAGE_KEY };
export default i18n;
