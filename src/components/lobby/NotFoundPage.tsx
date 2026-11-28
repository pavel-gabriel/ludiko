import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Any address that matches no route (a mistyped or outdated link): a friendly message instead of a blank screen */
export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="page" data-testid="not-found">
      <div className="card flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="text-6xl" aria-hidden="true">🧭</div>
        <h1 className="text-2xl font-extrabold text-ludiko-purple">{t('notFound.title')}</h1>
        <p className="opacity-80">{t('notFound.body')}</p>
        <Link
          to="/"
          className="flex min-h-[48px] items-center justify-center rounded-2xl bg-ludiko-green px-8 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  );
}
