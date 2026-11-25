import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { onAuthChange } from '@/services/authService';
import { getTeacherProfile } from '@/services/teacherService';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { flushQueuedReports } from '@/services/reportService';

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
    const flush = () => { flushQueuedReports().catch(() => {}); };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  /* Restore auth state on app mount / page refresh */
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
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
    return () => unsub();
  }, []);

  return (
    <ErrorBoundary>
      <Providers>
        <AppRoutes />
      </Providers>
    </ErrorBoundary>
  );
}
