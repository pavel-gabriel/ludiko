import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

export default function MultiplayerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-ludiko-purple mb-2">
          {t('home.multiplayer')}
        </h1>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button variant="pink" size="lg" onClick={() => navigate('/create')}>
          {t('home.createRoom')}
        </Button>
        <Button variant="blue" size="lg" onClick={() => navigate('/join')}>
          {t('home.joinRoom')}
        </Button>
        <Button variant="orange" size="md" onClick={() => navigate('/')}>
          {t('create.back')}
        </Button>
      </div>
    </div>
  );
}
