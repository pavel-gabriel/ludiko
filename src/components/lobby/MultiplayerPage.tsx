import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CloseButton from '@/components/ui/CloseButton';
import HowToPlay from '@/ui/guide/HowToPlay';
import { firebaseEnabled } from '@/services/firebase';

/** Two big cards: start a room, or join one with a code (the two-on-one-phone duel lives on the home screen) */
export default function MultiplayerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="page relative" role="main">
      <CloseButton />
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-ludiko-text">{t('home.friendsTitle')}</h1>
        <p className="mt-1 text-base text-ludiko-text opacity-75">{t('home.multiplayerSub')}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        {!firebaseEnabled && (
          <p role="status" className="rounded-2xl bg-ludiko-yellow p-3 text-center text-sm font-bold" data-testid="online-unavailable">
            {t('home.onlineUnavailable')}
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate('/create')}
          data-testid="multi-create"
          className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-3xl bg-ludiko-pink px-4 py-5 text-center shadow-lg transition-all hover:bg-pink-300 active:scale-[0.97]"
        >
          <span aria-hidden="true" className="text-5xl">🏠</span>
          <span className="text-2xl font-extrabold leading-tight text-ludiko-text">{t('home.createRoomTitle')}</span>
          <span className="text-sm leading-snug text-ludiko-text opacity-80">{t('home.createRoomSub')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/join')}
          data-testid="multi-join"
          className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-3xl bg-ludiko-blue px-4 py-5 text-center shadow-lg transition-all hover:bg-sky-300 active:scale-[0.97]"
        >
          <span aria-hidden="true" className="text-5xl">🔑</span>
          <span className="text-2xl font-extrabold leading-tight text-ludiko-text">{t('home.joinRoomTitle')}</span>
          <span className="text-sm leading-snug text-ludiko-text opacity-80">{t('home.joinRoomSub')}</span>
        </button>
        <HowToPlay topic="friends" />
      </div>
    </div>
  );
}
