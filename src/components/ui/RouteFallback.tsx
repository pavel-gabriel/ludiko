import { useTranslation } from 'react-i18next';

/** Kid-friendly loading screen shown while a lazy route chunk loads */
export default function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex flex-col items-center justify-center bg-ludiko-bg text-ludiko-text font-nunito gap-4"
    >
      <div className="text-6xl animate-bounce" aria-hidden="true">⭐</div>
      <p className="text-lg font-bold">{t('pwa.loading')}</p>
    </div>
  );
}
