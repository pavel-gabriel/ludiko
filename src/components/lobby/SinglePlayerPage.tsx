import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { buildLocalPlayer, buildLocalRoom } from '@/services/session/localRoom';
import SetupWizard from '@/components/setup/SetupWizard';
import type { SetupResult } from '@/components/setup/setupModel';
import { identityAvatar, identityName } from '@/utils/animalNames';

/** Single player: the setup wizard, then a one-player room that starts at once */
export default function SinglePlayerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  /* Solo is played on this device only: no Firebase, no network (services/session/localSession.ts) */
  const handlePlay = async ({ settings, identity }: SetupResult) => {
    const player = buildLocalPlayer(identityName(identity, i18n.language), 0, identityAvatar(identity));
    const room = buildLocalRoom([player], settings);
    setRoom(room);
    setCurrentPlayer(room.players[0]);
    navigate('/game');
  };

  return <SetupWizard context="single" startLabel={t('home.play')} onStart={handlePlay} />;
}
