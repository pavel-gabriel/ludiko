import { useTranslation } from 'react-i18next';
import type { GameType } from '@/utils/types';

interface PlayModePickerProps {
  value: GameType;
  onChange: (type: GameType) => void;
}

/**
 * Shown instead of the v1 game-type picker once skills are chosen: with items any skill can be
 * raced (Cursă) or turned into memory pairs (Memorie). The Race / Sprint choice stays in the room's own settings.
 */
export default function PlayModePicker({ value, onChange }: PlayModePickerProps) {
  const { t } = useTranslation();
  const modes: { type: GameType; emoji: string; label: string }[] = [
    { type: 'mathRace', emoji: '🏎️', label: t('play.modeRace') },
    { type: 'memoryGame', emoji: '🃏', label: t('play.modeMemory') },
  ];
  return (
    <div role="group" aria-label={t('play.modeTitle')}>
      <span className="text-sm font-semibold">{t('play.modeTitle')}</span>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {modes.map((m) => (
          <button
            key={m.type}
            type="button"
            onClick={() => onChange(m.type)}
            aria-pressed={(value === 'memoryGame') === (m.type === 'memoryGame')}
            className={`py-2 px-1 rounded-xl font-bold text-sm transition-colors ${
              (value === 'memoryGame') === (m.type === 'memoryGame')
                ? 'bg-ludiko-purple text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
