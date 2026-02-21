import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import {
  listenToRoom,
  updateRoomStatus,
  deleteRoom,
  setPlayerReady,
} from '@/services/roomManager';

export default function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, setRoom, setCurrentPlayer, reset } = useRoomStore();
  const [copied, setCopied] = useState(false);

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

      /* Keep currentPlayer in sync with RTDB (e.g. isReady changes) */
      if (currentPlayer) {
        const me = updatedRoom.players.find((p) => p.id === currentPlayer.id);
        if (me) setCurrentPlayer(me);
      }

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
  const myIndex = room.players.findIndex((p) => p.id === currentPlayer.id);

  /* All non-host players must be ready for host to start */
  const allOthersReady = room.players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const canStart = isHost && allOthersReady;

  const handleLeave = async () => {
    if (isHost) {
      /* Host leaving deletes the room for everyone */
      await deleteRoom(room.id);
    }
    reset();
    navigate('/');
  };

  const handleReady = async () => {
    if (myIndex < 0) return;
    await setPlayerReady(room.id, myIndex, !currentPlayer.isReady);
  };

  const handleStart = async () => {
    if (!canStart) return;
    /* Set room status to 'playing' — all listeners will navigate to game */
    await updateRoomStatus(room.id, 'playing');
  };

  return (
    <div className="page">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center">{t('lobby.title')}</h2>

        <div className="text-center mb-6">
          <span className="text-sm text-gray-500">{t('lobby.roomCode')}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(room.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {});
            }}
            className="block mx-auto text-3xl font-extrabold tracking-widest text-ludiko-purple hover:text-ludiko-blue transition-colors cursor-pointer"
            title={t('lobby.copyCode')}
          >
            {room.code}
          </button>
          {copied && (
            <span className="text-xs text-ludiko-green font-bold animate-pulse">
              {t('lobby.copied')}
            </span>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            {t('lobby.players')} ({room.players.length})
          </h3>
          <ul className="space-y-2" role="list" aria-label="Player list">
            {room.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                aria-label={`${player.name}${player.isHost ? ' (Host)' : ''}${player.isReady ? ' - Ready' : ''}`}
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
          <div className="text-center mb-4">
            <p className="text-gray-400 text-sm">{t('lobby.waitingForPlayers')}</p>
            {isHost && (
              <p className="text-gray-300 text-xs mt-1">{t('lobby.soloHint')}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={handleLeave}>
            {t('lobby.leave')}
          </Button>
          {!isHost && (
            <Button
              variant={currentPlayer.isReady ? 'orange' : 'green'}
              size="md"
              className="flex-1"
              onClick={handleReady}
            >
              {currentPlayer.isReady ? t('lobby.cancelReady') : t('lobby.markReady')}
            </Button>
          )}
          {isHost && (
            <Button
              variant="green"
              size="md"
              className="flex-1"
              onClick={handleStart}
              disabled={!canStart}
            >
              {t('lobby.startGame')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
