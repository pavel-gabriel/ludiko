import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.pageTitle');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

  return (
    <ErrorBoundary>
      <Providers>
        <AppRoutes />
      </Providers>
    </ErrorBoundary>
  );
}
