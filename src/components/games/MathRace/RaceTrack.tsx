import type { Player } from '@/utils/types';

interface RaceTrackProps {
  players: Player[];
  /** Per-player progress: playerId -> correct answers count */
  progress: Record<string, number>;
  totalQuestions: number;
}

/**
 * Visual race view: each player's character advances along a horizontal
 * track toward a finish line based on how many questions they've answered
 * correctly. Inspired by afifedu.com split-screen race mechanic.
 */
export default function RaceTrack({
  players,
  progress,
  totalQuestions,
}: RaceTrackProps) {
  return (
    <div className="w-full space-y-3" role="region" aria-label="Race track">
      {players.map((player) => {
        const correct = progress[player.id] ?? 0;
        /* Position as a percentage of the track (0% to 100%) */
        const position =
          totalQuestions > 0
            ? Math.min((correct / totalQuestions) * 100, 100)
            : 0;
        const finished = correct >= totalQuestions;

        return (
          <div
            key={player.id}
            className="relative"
            role="progressbar"
            aria-valuenow={correct}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-label={`${player.name}: ${correct}/${totalQuestions}`}
          >
            {/* Player label */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{player.avatar}</span>
              <span className="text-xs font-bold truncate max-w-[80px]">
                {player.name}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {correct}/{totalQuestions}
              </span>
            </div>

            {/* Track */}
            <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
              {/* Finish line indicator */}
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-ludiko-purple z-10" />

              {/* Runner — the character that moves along the track */}
              <div
                className="absolute top-0 bottom-0 flex items-center transition-all duration-500 ease-out"
                style={{ left: `${position}%` }}
              >
                <span
                  className={`text-2xl -translate-x-1/2 ${
                    finished ? 'animate-bounce' : ''
                  }`}
                >
                  {player.avatar}
                </span>
              </div>

              {/* Progress fill */}
              <div
                className="h-full bg-ludiko-green/30 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${position}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
