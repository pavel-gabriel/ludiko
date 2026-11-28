import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import LegalLink from '@/components/legal/LegalLink';
import CloseButton from '@/components/ui/CloseButton';
import { lazy, Suspense } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

const VoiceSettings = lazy(() => import('@/ui/speech/VoiceSettings'));

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
            role="switch"
            aria-checked={soundEnabled}
            className={`w-14 h-11 rounded-full transition-colors relative ${
              soundEnabled ? 'bg-ludiko-green' : 'bg-gray-300'
            }`}
            aria-label={t('settings.sound')}
          >
            <span
              className={`absolute top-2.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
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
                aria-pressed={language === lang}
                lang={lang}
                className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${
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

        <Suspense fallback={null}>
          <VoiceSettings />
        </Suspense>

        {/* Dyslexic font */}
        <div className="flex items-center justify-between py-3">
          <span className="font-semibold">{t('settings.dyslexicFont')}</span>
          <button
            onClick={toggleDyslexicFont}
            role="switch"
            aria-checked={dyslexicFont}
            className={`w-14 h-11 rounded-full transition-colors relative ${
              dyslexicFont ? 'bg-ludiko-green' : 'bg-gray-300'
            }`}
            aria-label={t('settings.dyslexicFont')}
          >
            <span
              className={`absolute top-2.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                dyslexicFont ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Credits & licences */}
        <Link
          to="/credits"
          className="mt-4 flex min-h-[44px] items-center justify-center text-center text-sm font-semibold text-ludiko-purple hover:underline"
        >
          {t('credits.title')}
        </Link>
        <p className="mt-2 flex flex-wrap justify-center gap-x-4 text-center text-sm font-semibold text-ludiko-purple">
          <LegalLink to="privacy" className="min-h-[44px] hover:underline">{t('legal.privacyLink')}</LegalLink>
          <LegalLink to="terms" className="min-h-[44px] hover:underline">{t('legal.termsLink')}</LegalLink>
        </p>
      </div>
    </div>
  );
}
