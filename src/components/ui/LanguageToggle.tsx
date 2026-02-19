import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const toggle = () => {
    const next = i18n.language === 'ro' ? 'en' : 'ro';
    i18n.changeLanguage(next);
    setLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-lg bg-white shadow text-sm font-bold
                 text-ludiko-text hover:bg-gray-50 transition-colors"
      aria-label="Toggle language"
    >
      {i18n.language === 'ro' ? 'RO' : 'EN'}
    </button>
  );
}
