import { useTranslation } from 'react-i18next';
import type { GameType } from '@/utils/types';
import { GAME_CATEGORIES, GAME_TYPES } from '@/utils/constants';

interface GameTypePickerProps {
  value: GameType;
  onChange: (type: GameType) => void;
  /** Unselected button background classes */
  idleClassName?: string;
}

/**
 * Game type selector, grouped into categories:
 * Math games (Math Race, Equations, Counting, Sequence) and Other games (Shapes, Memory).
 */
export default function GameTypePicker({
  value,
  onChange,
  idleClassName = 'bg-gray-100 hover:bg-gray-200',
}: GameTypePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 mt-1">
      {GAME_CATEGORIES.map(({ category, labelKey }) => (
        <div key={category} role="group" aria-label={t(labelKey)}>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            {t(labelKey)}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {GAME_TYPES.filter((g) => g.category === category).map(({ type, emoji, labelKey: gameLabel }) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange(type)}
                aria-pressed={value === type}
                className={`py-2 px-1 rounded-xl font-bold text-sm transition-colors ${
                  value === type ? 'bg-ludiko-purple text-white' : idleClassName
                }`}
              >
                {emoji} {t(gameLabel)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
