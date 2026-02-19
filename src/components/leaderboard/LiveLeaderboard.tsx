import { useTranslation } from 'react-i18next';
import type { Player } from '@/utils/types';

interface LiveLeaderboardProps {
  players: Player[];
  /** Progress per player: playerId -> number of correct answers */
  progress: Record<string, number>;
  totalQuestions: number;
}

/**
 * Live leaderboard shown during a game session.
 * Displays each player's avatar, name, and progress bar.
 */
export default function LiveLeaderboard({
  players,
  progress,
  totalQuestions,
}: LiveLeaderboardProps) {
  const { t } = useTranslation();

  /* Sort players by progress (most correct answers first) */
  const sorted = [...players].sort(
    (a, b) => (progress[b.id] ?? 0) - (progress[a.id] ?? 0),
  );

  return (
    <div className="w-full max-w-md mx-auto">
      <h3 className="text-sm font-semibold text-gray-500 mb-2">
        {t('game.leaderboard')}
      </h3>
      <ul className="space-y-2">
        {sorted.map((player, index) => {
          const correct = progress[player.id] ?? 0;
          const pct = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;

          return (
            <li
              key={player.id}
              className="flex items-center gap-3 bg-white/80 rounded-xl px-4 py-2"
            >
              <span className="text-sm font-bold text-gray-400 w-5">
                {index + 1}
              </span>
              <span className="text-xl">{player.avatar}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold truncate block">
                  {player.name}
                </span>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-2 bg-ludiko-green rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {correct}/{totalQuestions}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
