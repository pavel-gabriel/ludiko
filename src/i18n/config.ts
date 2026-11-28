import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ro from './ro.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ro: { translation: ro },
      en: { translation: en },
    },
    fallbackLng: 'ro',
    supportedLngs: ['ro', 'en'],
    interpolation: {
      escapeValue: false,
    },
    // Romanian by default on first load, whatever the browser language. English only after the user picks it
    // (the choice is remembered under its own key; the old auto-detected `i18nextLng` value is ignored on purpose).
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'ludiko-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
