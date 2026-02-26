import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { onAuthChange } from '@/services/authService';
import { getTeacherProfile } from '@/services/teacherService';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const { t, i18n } = useTranslation();
  const { setUid, setTeacherProfile, setLoading } = useAuthStore();

  useEffect(() => {
    document.title = t('app.pageTitle');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

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
