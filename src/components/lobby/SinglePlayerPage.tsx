import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import SetupWizard from '@/components/setup/SetupWizard';
import type { SetupResult } from '@/components/setup/setupModel';
import { identityAvatar, identityName } from '@/utils/animalNames';

/** Single player: the setup wizard, then a one-player room that starts at once */
export default function SinglePlayerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const handlePlay = async ({ settings, identity }: SetupResult) => {
    await ensureAnonymousAuth();
    const room = buildRoom(identityName(identity, i18n.language), settings, identityAvatar(identity));
    room.status = 'playing';
    await createRoomInDB(room);
    registerDisconnectCleanup(room.id, true, undefined, room.code);
    setRoom(room);
    setCurrentPlayer(room.players[0]);
    navigate('/game');
  };

  return <SetupWizard context="single" startLabel={t('home.play')} onStart={handlePlay} />;
}
