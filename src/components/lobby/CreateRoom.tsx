import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import SetupWizard from '@/components/setup/SetupWizard';
import type { SetupResult } from '@/components/setup/setupModel';
import { identityAvatar, identityName } from '@/utils/animalNames';

/** New online room: the setup wizard (race, sprint or memory), then the lobby where friends join by code */
export default function CreateRoom() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const handleCreate = async ({ settings, identity }: SetupResult) => {
    await ensureAnonymousAuth();
    const room = buildRoom(identityName(identity, i18n.language), settings, identityAvatar(identity));
    await createRoomInDB(room);
    registerDisconnectCleanup(room.id, true, undefined, room.code);
    setRoom(room);
    setCurrentPlayer(room.players[0]);
    navigate('/lobby');
  };

  return <SetupWizard context="room" startLabel={t('create.create')} onStart={handleCreate} />;
}
