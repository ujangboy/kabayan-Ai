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

// Jaga atribut <html lang> agar sesuai bahasa aktif (aksesibilitas &
// penerjemahan browser). Ini juga menutup kasus bahasa tersimpan != id.
function syncDocumentLanguage(lang) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = ['id', 'en', 'su'].includes(lang) ? lang : 'id';
  }
}

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

export function getAppLanguage() {
  return i18n.language && ['id', 'en', 'su'].includes(i18n.language) ? i18n.language : 'id';
}

export function setAppLanguage(lang) {
  const normalized = ['id', 'en', 'su'].includes(lang) ? lang : 'id';
  const result = i18n.changeLanguage(normalized);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* abaikan */
  }
  return result;
}

export { STORAGE_KEY };
export default i18n;
