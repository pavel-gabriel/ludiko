import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { buildLocalPlayer, buildLocalRoom, localCoPlayerId } from '@/services/session/localRoom';
import SetupWizard from '@/components/setup/SetupWizard';
import type { SetupResult } from '@/components/setup/setupModel';
import { identityAvatar, identityName } from '@/utils/animalNames';

/** Duel ("two on one phone"): the setup wizard with both players' animals, then the shared-screen game */
export default function InteractiveSetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const handleStart = async ({ settings, identity, identity2 }: SetupResult) => {
    const avatar1 = identityAvatar(identity);
    const avatar2 = identityAvatar(identity2);
    if (avatar1 === avatar2) return;
    /* Two on one phone is played on this device only: no Firebase, no network */
    const player1 = buildLocalPlayer(identityName(identity, i18n.language), 0, avatar1);
    const player2 = buildLocalPlayer(identityName(identity2, i18n.language), 1, avatar2, localCoPlayerId(player1.id));
    player2.isHost = false;
    const room = buildLocalRoom([player1, player2], settings);
    setRoom(room);
    setCurrentPlayer(room.players[0]);
    navigate('/game/interactive');
  };

  return <SetupWizard context="duel" startLabel={t('home.play')} onStart={handleStart} />;
}
