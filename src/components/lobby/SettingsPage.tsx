import { useTranslation } from 'react-i18next';
import CloseButton from '@/components/ui/CloseButton';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { language, dyslexicFont, soundEnabled, setLanguage, toggleDyslexicFont, toggleSound } = useSettingsStore();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang as 'ro' | 'en');
  };

  return (
    <div className="page">
      <div className="card w-full max-w-sm relative">
        <CloseButton />
        <h2 className="text-2xl font-bold mb-6 text-center">{t('home.settings')}</h2>

        {/* Sound */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="font-semibold">{t('settings.sound')}</span>
          <button
            onClick={toggleSound}
            className={`w-14 h-8 rounded-full transition-colors relative ${
              soundEnabled ? 'bg-ludiko-green' : 'bg-gray-300'
            }`}
            aria-label={t('settings.sound')}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                soundEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="font-semibold">{t('settings.language')}</span>
          <div className="flex gap-1">
            {(['ro', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${
                  language === lang
                    ? 'bg-ludiko-purple text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Dyslexic font */}
        <div className="flex items-center justify-between py-3">
          <span className="font-semibold">{t('settings.dyslexicFont')}</span>
          <button
            onClick={toggleDyslexicFont}
            className={`w-14 h-8 rounded-full transition-colors relative ${
              dyslexicFont ? 'bg-ludiko-green' : 'bg-gray-300'
            }`}
            aria-label={t('settings.dyslexicFont')}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                dyslexicFont ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

      </div>
    </div>
  );
}
