import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

const OFFLINE_READY_KEY = 'ludiko-offline-ready-shown';

function alreadyShown(): boolean {
  try {
    return localStorage.getItem(OFFLINE_READY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Service-worker registration + "new version" / "offline ready" toasts */
export default function PwaToast() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const showOfflineReady = offlineReady && !needRefresh && !alreadyShown();

  const closeOfflineReady = () => {
    try {
      localStorage.setItem(OFFLINE_READY_KEY, '1');
    } catch {
      /* storage unavailable — toast may reappear, harmless */
    }
    setOfflineReady(false);
  };

  if (!needRefresh && !showOfflineReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 bg-white text-ludiko-text font-nunito rounded-2xl shadow-lg border border-ludiko-purple px-4 py-3 text-sm">
        <span className="font-semibold">
          {needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}
        </span>
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded-full bg-ludiko-green px-3 py-1 font-bold hover:brightness-95"
          >
            {t('pwa.update')}
          </button>
        )}
        <button
          onClick={() => (needRefresh ? setNeedRefresh(false) : closeOfflineReady())}
          aria-label={t('pwa.dismiss')}
          className="text-lg leading-none px-1 opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
