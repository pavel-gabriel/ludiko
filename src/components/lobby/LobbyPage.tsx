import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import { listenToRoom, updateRoomStatus, deleteRoom } from '@/services/roomManager';

export default function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, setRoom, reset } = useRoomStore();

  /* Subscribe to real-time room updates from RTDB */
  useEffect(() => {
    if (!room) return;

    const unsubscribe = listenToRoom(room.id, (updatedRoom) => {
      if (!updatedRoom) {
        /* Room was deleted (host disconnected) */
        reset();
        navigate('/');
        return;
      }
      setRoom(updatedRoom);

      /* If room status changed to 'playing', navigate to game */
      if (updatedRoom.status === 'playing') {
        navigate('/game');
      }
    });

    return () => unsubscribe();
  }, [room?.id]);

  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  const isHost = currentPlayer.isHost;

  const handleLeave = async () => {
    if (isHost) {
      /* Host leaving deletes the room for everyone */
      await deleteRoom(room.id);
    }
    reset();
    navigate('/');
  };

  const handleStart = async () => {
    /* Set room status to 'playing' — all listeners will navigate to game */
    await updateRoomStatus(room.id, 'playing');
  };

  return (
    <div className="page">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center">{t('lobby.title')}</h2>

        <div className="text-center mb-6">
          <span className="text-sm text-gray-500">{t('lobby.roomCode')}</span>
          <p className="text-3xl font-extrabold tracking-widest text-ludiko-purple">
            {room.code}
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            {t('lobby.players')} ({room.players.length})
          </h3>
          <ul className="space-y-2">
            {room.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
              >
                <span className="text-2xl">{player.avatar}</span>
                <span className="font-bold flex-1">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs bg-ludiko-yellow px-2 py-1 rounded-lg font-bold">
                    HOST
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded-lg font-bold ${
                    player.isReady
                      ? 'bg-ludiko-green text-green-800'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {player.isReady ? t('lobby.ready') : t('lobby.notReady')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {room.players.length < 2 && (
          <p className="text-center text-gray-400 text-sm mb-4">
            {t('lobby.waitingForPlayers')}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={handleLeave}>
            {t('lobby.leave')}
          </Button>
          {isHost && (
            <Button
              variant="green"
              size="md"
              className="flex-1"
              onClick={handleStart}
            >
              {t('lobby.startGame')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
