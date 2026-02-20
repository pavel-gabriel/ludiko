import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Providers from '@/app/providers';
import AppRoutes from '@/app/AppRoutes';

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.pageTitle');
  }, [i18n.language, t]);

  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}
