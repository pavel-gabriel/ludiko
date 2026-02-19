import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import type { Player } from '@/utils/types';

interface GameResultsProps {
  players: Player[];
  /** Final scores: playerId -> total correct answers */
  scores: Record<string, number>;
  totalQuestions: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

/**
 * End-of-game results screen.
 * Shows rankings, accuracy %, and action buttons.
 */
export default function GameResults({
  players,
  scores,
  totalQuestions,
  onPlayAgain,
  onExit,
}: GameResultsProps) {
  const { t } = useTranslation();

  /* Sort players by score descending */
  const ranked = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0),
  );

  return (
    <div className="page">
      <div className="card w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-6">{t('results.title')}</h2>

        <ul className="space-y-3 mb-8">
          {ranked.map((player, index) => {
            const score = scores[player.id] ?? 0;
            const accuracy =
              totalQuestions > 0
                ? Math.round((score / totalQuestions) * 100)
                : 0;

            return (
              <li
                key={player.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  index === 0
                    ? 'bg-ludiko-yellow/40 ring-2 ring-ludiko-yellow'
                    : 'bg-gray-50'
                }`}
              >
                <span className="text-lg font-extrabold text-gray-400 w-6">
                  {index + 1}
                </span>
                <span className="text-2xl">{player.avatar}</span>
                <span className="font-bold flex-1 text-left">
                  {player.name}
                </span>
                <span className="text-sm font-semibold">
                  {score}/{totalQuestions} ({accuracy}%)
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={onExit}>
            {t('results.exit')}
          </Button>
          <Button variant="green" size="md" className="flex-1" onClick={onPlayAgain}>
            {t('results.playAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}
