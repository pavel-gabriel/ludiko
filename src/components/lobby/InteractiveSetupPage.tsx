import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, buildPlayer, coPlayerId, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
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
    await ensureAnonymousAuth();
    const room = buildRoom(identityName(identity, i18n.language), settings, avatar1);

    /* Add player 2 to the room */
    const player2 = buildPlayer(identityName(identity2, i18n.language), 1, avatar2, coPlayerId(room.hostId));
    player2.isReady = true;
    room.players.push(player2);
    room.status = 'playing';

    await createRoomInDB(room);
    registerDisconnectCleanup(room.id, true, undefined, room.code);
    setRoom(room);
    setCurrentPlayer(room.players[0]);
    navigate('/game/interactive');
  };

  return <SetupWizard context="duel" startLabel={t('home.play')} onStart={handleStart} />;
}
