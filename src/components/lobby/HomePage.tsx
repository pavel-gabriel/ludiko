import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import LanguageToggle from '@/components/ui/LanguageToggle';
import DyslexiaToggle from '@/components/ui/DyslexiaToggle';
import PersistentLeaderboard from '@/components/leaderboard/PersistentLeaderboard';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="absolute top-4 right-4 flex gap-2">
        <DyslexiaToggle />
        <LanguageToggle />
      </div>

      <div className="text-center mb-12">
        <h1 className="text-6xl font-extrabold text-ludiko-purple mb-2">
          {t('app.title')}
        </h1>
        <p className="text-xl text-ludiko-text opacity-75">
          {t('home.tagline')}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button variant="pink" size="lg" onClick={() => navigate('/create')}>
          {t('home.createRoom')}
        </Button>
        <Button variant="blue" size="lg" onClick={() => navigate('/join')}>
          {t('home.joinRoom')}
        </Button>
      </div>

      {/* Persistent leaderboard (shows only when history exists) */}
      <PersistentLeaderboard />
    </div>
  );
}
