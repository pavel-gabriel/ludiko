import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';

export default function DyslexiaToggle() {
  const { t } = useTranslation();
  const { dyslexicFont, toggleDyslexicFont } = useSettingsStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dyslexic-mode', dyslexicFont);
  }, [dyslexicFont]);

  return (
    <button
      onClick={toggleDyslexicFont}
      className={`px-3 py-1.5 rounded-lg shadow text-sm font-bold
                  transition-colors ${
                    dyslexicFont
                      ? 'bg-ludiko-purple text-white'
                      : 'bg-white text-ludiko-text hover:bg-gray-50'
                  }`}
      aria-label={t('settings.dyslexicFont')}
    >
      Aa
    </button>
  );
}
