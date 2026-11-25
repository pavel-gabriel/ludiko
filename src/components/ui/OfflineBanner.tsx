import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Small unobtrusive banner shown only while the device is offline */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none px-4 pt-2"
    >
      <p className="pointer-events-auto bg-ludiko-yellow text-ludiko-text text-sm font-semibold font-nunito rounded-full px-4 py-1 shadow-md">
        {t('pwa.offline')}
      </p>
    </div>
  );
}
