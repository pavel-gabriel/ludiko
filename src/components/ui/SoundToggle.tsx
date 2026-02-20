import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';

export default function SoundToggle() {
  const { t } = useTranslation();
  const { soundEnabled, toggleSound } = useSettingsStore();

  return (
    <button
      onClick={toggleSound}
      className={`px-3 py-1.5 rounded-lg shadow text-sm font-bold
                  transition-colors ${
                    soundEnabled
                      ? 'bg-ludiko-purple text-white'
                      : 'bg-white text-ludiko-text hover:bg-gray-50'
                  }`}
      aria-label={t('settings.sound')}
    >
      {soundEnabled ? '🔊' : '🔇'}
    </button>
  );
}
