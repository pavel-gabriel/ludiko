import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import { saveGameHistory, type PlayerResult } from '@/services/historyService';
import type { Player, GameMode } from '@/utils/types';
import { serverTimestamp } from 'firebase/firestore';
import { playFinish } from '@/utils/sounds';
import Confetti from '@/components/ui/Confetti';

interface GameResultsProps {
  players: Player[];
  scores: Record<string, number>;
  totalQuestions: number;
  /** Per-player finish timestamps for speed-based ranking */
  finishTimes?: Record<string, number>;
  /** Game mode — used to decide ranking strategy */
  gameMode?: GameMode;
  /** Timestamp (ms) when the game started playing — used to compute elapsed time */
  startedAt?: number;
  /** Replay the same game (go to lobby and re-start) */
  onPlayAgain: () => void;
  /** New game configuration (go to home page) */
  onNewGame: () => void;
}

const PODIUM_HEIGHTS = [140, 100, 72];
const PODIUM_COLORS = ['bg-ludiko-yellow', 'bg-gray-200', 'bg-orange-200'];
const PODIUM_RINGS = ['ring-yellow-400', 'ring-gray-400', 'ring-orange-400'];
const PLACE_LABELS = ['1st', '2nd', '3rd'];

/** Format elapsed seconds as M:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GameResults({
  players,
  scores,
  totalQuestions,
  finishTimes,
  gameMode,
  startedAt,
  onPlayAgain,
  onNewGame,
}: GameResultsProps) {
  const { t } = useTranslation();
  const { room } = useRoomStore();
  const savedRef = useRef(false);

  useEffect(() => { playFinish(); }, []);

  /* Rank players based on game mode */
  const ranked = [...players].sort((a, b) => {
    const scoreA = scores[a.id] ?? 0;
    const scoreB = scores[b.id] ?? 0;

    if (gameMode === 'timedSprint' && finishTimes) {
      /* Timed sprint: rank by most correct answers, then by fastest finish */
      if (scoreA !== scoreB) return scoreB - scoreA;
      const timeA = finishTimes[a.id] ?? Infinity;
      const timeB = finishTimes[b.id] ?? Infinity;
      return timeA - timeB;
    }

    /* Race to finish / default: rank by most correct, then by fastest finish */
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (finishTimes) {
      const timeA = finishTimes[a.id] ?? Infinity;
      const timeB = finishTimes[b.id] ?? Infinity;
      return timeA - timeB;
    }
    return 0;
  });

  useEffect(() => {
    if (savedRef.current || !room) return;
    savedRef.current = true;

    const results: PlayerResult[] = ranked.map((player, idx) => {
      const score = scores[player.id] ?? 0;
      return {
        name: player.name,
        avatar: player.avatar,
        score,
        totalQuestions,
        accuracy: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0,
        rank: idx + 1,
      };
    });

    saveGameHistory({
      roomCode: room.code,
      gameType: room.settings.gameType,
      gameMode: room.settings.gameMode,
      difficulty: room.settings.difficulty,
      playerCount: players.length,
      results,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }, []);

  const podiumPlayers = ranked.slice(0, 3);
  const restPlayers = ranked.slice(3);

  const podiumDisplay = podiumPlayers.length >= 3
    ? [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]]
    : podiumPlayers;
  const podiumOrder = podiumPlayers.length >= 3 ? [1, 0, 2] : podiumPlayers.map((_, i) => i);

  return (
    <div className="page">
      <Confetti />
      <div className="card w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-2">{t('results.title')}</h2>

        {ranked.length > 0 && (
          <p className="text-sm text-ludiko-purple font-bold mb-4 animate-bounce">
            {ranked[0].avatar} {ranked[0].name} — {t('results.champion')}
          </p>
        )}

        {podiumPlayers.length > 0 && (
          <div
            className="flex items-end justify-center gap-2 sm:gap-3 mb-6"
            role="img"
            aria-label="Podium: top 3 players"
          >
            {podiumDisplay.map((player, displayIdx) => {
              const rank = podiumOrder[displayIdx];
              const score = scores[player.id] ?? 0;
              const accuracy =
                totalQuestions > 0
                  ? Math.round((score / totalQuestions) * 100)
                  : 0;
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center animate-slide-up"
                  style={{ animationDelay: `${rank * 200}ms` }}
                >
                  <span className="text-3xl mb-1">{player.avatar}</span>
                  <span className="text-xs font-bold truncate max-w-[80px]">
                    {player.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {score}/{totalQuestions} ({accuracy}%)
                  </span>
                  {startedAt && finishTimes?.[player.id] && (
                    <span className="text-xs text-ludiko-purple font-bold">
                      {t('results.finishTime')}: {formatTime(Math.round((finishTimes[player.id] - startedAt) / 1000))}
                    </span>
                  )}
                  <div
                    className={`w-16 sm:w-20 rounded-t-xl flex items-center justify-center mt-1
                      ${PODIUM_COLORS[rank]} ring-2 ${PODIUM_RINGS[rank]}
                      transition-all duration-700`}
                    style={{ height: `${PODIUM_HEIGHTS[rank]}px` }}
                  >
                    <span className="text-lg font-extrabold text-gray-700">
                      {PLACE_LABELS[rank]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {restPlayers.length > 0 && (
          <ul className="space-y-2 mb-6">
            {restPlayers.map((player, index) => {
              const score = scores[player.id] ?? 0;
              const accuracy =
                totalQuestions > 0
                  ? Math.round((score / totalQuestions) * 100)
                  : 0;
              return (
                <li
                  key={player.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 bg-gray-50"
                >
                  <span className="text-lg font-extrabold text-gray-400 w-6">
                    {index + 4}
                  </span>
                  <span className="text-2xl">{player.avatar}</span>
                  <span className="font-bold flex-1 text-left">{player.name}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold">
                      {score}/{totalQuestions} ({accuracy}%)
                    </span>
                    {startedAt && finishTimes?.[player.id] && (
                      <span className="block text-xs text-ludiko-purple font-bold">
                        {t('results.finishTime')}: {formatTime(Math.round((finishTimes[player.id] - startedAt) / 1000))}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={onNewGame}>
            {t('results.newGame')}
          </Button>
          <Button variant="green" size="md" className="flex-1" onClick={onPlayAgain}>
            {t('results.replay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
