import { useEffect } from 'react';
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

  // "Offline ready" is informational: it goes away on its own so it never sits on a page's buttons
  useEffect(() => {
    if (!showOfflineReady) return;
    const id = window.setTimeout(closeOfflineReady, 6000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOfflineReady]);

  if (!needRefresh && !showOfflineReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="flex items-center gap-3 bg-white text-ludiko-text font-nunito rounded-2xl shadow-lg border border-ludiko-purple px-4 py-3 text-sm">
        <span className="font-semibold">
          {needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}
        </span>
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="pointer-events-auto min-h-[44px] rounded-full bg-ludiko-green px-3 py-1 font-bold hover:brightness-95"
          >
            {t('pwa.update')}
          </button>
        )}
        <button
          onClick={() => (needRefresh ? setNeedRefresh(false) : closeOfflineReady())}
          aria-label={t('pwa.dismiss')}
          className="pointer-events-auto min-h-[44px] min-w-[44px] text-lg leading-none px-1 opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
