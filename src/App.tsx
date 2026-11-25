import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import OfflineBanner from '@/components/ui/OfflineBanner';
import PwaToast from '@/components/ui/PwaToast';
import { initFamilyGate } from '@/family/familyGate';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

export default function App() {
  const { t, i18n } = useTranslation();
  const { setUid, setTeacherProfile, setLoading } = useAuthStore();
  const dyslexicFont = useSettingsStore((s) => s.dyslexicFont);

  useEffect(() => {
    document.title = t('app.pageTitle');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

  /* Keep dyslexic-mode class on <html> in sync with store */
  useEffect(() => {
    document.documentElement.classList.toggle('dyslexic-mode', dyslexicFont);
  }, [dyslexicFont]);

  /* Send content reports that were queued while offline (on start + when back online) */
  useEffect(() => {
    /* Dynamic import keeps Firebase out of the initial bundle */
    const flush = () => {
      import('@/services/reportService')
        .then(({ flushQueuedReports }) => flushQueuedReports())
        .catch(() => {});
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  /* Parent account: sync once at start and when back online (a no-op unless a parent signed in here) */
  useEffect(() => {
    initFamilyGate();
  }, []);

  /* Restore auth state on app mount / page refresh */
  useEffect(() => {
    // Firebase is loaded lazily so the home page doesn't pay for it upfront
    // (initial-JS budget). Auth state is restored as soon as the chunk arrives.
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ onAuthChange }, { getTeacherProfile }] = await Promise.all([
        import('@/services/authService'),
        import('@/services/teacherService'),
      ]);
      if (cancelled) return;
      unsub = onAuthChange(async (user) => {
        if (user && !user.isAnonymous) {
          setUid(user.uid);
          try {
            const profile = await getTeacherProfile(user.uid);
            if (profile) setTeacherProfile(profile);
          } catch {
            /* Firestore may be unreachable — still set uid so navigation works */
          }
        } else {
          setUid(null);
          setTeacherProfile(null);
        }
        setLoading(false);
      });
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return (
    <ErrorBoundary>
      <Providers>
        <OfflineBanner />
        <AppRoutes />
        <PwaToast />
      </Providers>
    </ErrorBoundary>
  );
}
