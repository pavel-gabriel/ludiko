import { useTranslation } from 'react-i18next';
import type { Difficulty, ShapeMode } from '@/utils/types';
import {
  isMemory,
  roundsLimits,
  showsShapeMode,
  timeLimits,
  type SetupChoices,
  type SetupContext,
} from './setupModel';

const chip = (on: boolean) =>
  `flex-1 min-h-[3rem] rounded-xl px-2 py-2 text-base font-bold transition-colors ${
    on ? 'bg-ludiko-purple text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
  }`;

interface AdvancedSettingsProps {
  context: SetupContext;
  choices: SetupChoices;
  onChange: (patch: Partial<SetupChoices>) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** "Setări avansate" (collapsed): difficulty, shape mode, rounds / pairs and time. Shared by the game wizard and the teacher's session wizard. */
export default function AdvancedSettings({ context, choices, onChange, open, onToggle }: AdvancedSettingsProps) {
  const { t } = useTranslation();
  const memory = isMemory(choices);
  const sprint = choices.mode === 'sprint';
  const roundsLabel = memory ? t('create.pairs') : t('create.rounds');
  const timeLabel = memory || sprint ? t('create.totalTime') : t('create.timePerRound');
  const rl = roundsLimits(context, choices.mode);
  const tl = timeLimits(choices.mode);

  const numberInput = (value: number, limits: { min: number; max: number }, set: (n: number) => void, label: string) => (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
          set(isNaN(v) ? 0 : v);
        }}
        onBlur={() => set(!value || value < limits.min ? limits.min : value > limits.max ? limits.max : value)}
        className="mt-1 min-h-[3rem] w-full rounded-xl border-2 border-ludiko-blue px-4 py-2 text-lg focus:outline-none focus:border-ludiko-purple"
      />
    </label>
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-gray-600"
      >
        {t('setup.advanced')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-4 rounded-2xl bg-white p-4 shadow">
          {!memory && (
            <div role="group" aria-label={t('create.difficulty')}>
              <span className="text-sm font-semibold">{t('create.difficulty')}</span>
              <div className="mt-1 flex gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                  <button key={d} type="button" aria-pressed={choices.difficulty === d} onClick={() => onChange({ difficulty: d })} className={chip(choices.difficulty === d)}>
                    {t(`create.${d}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showsShapeMode(choices) && (
            <div role="group" aria-label={t('create.shapeMode')}>
              <span className="text-sm font-semibold">{t('create.shapeMode')}</span>
              <div className="mt-1 flex gap-2">
                {(['image', 'word'] as ShapeMode[]).map((m) => (
                  <button key={m} type="button" aria-pressed={choices.shapeMode === m} onClick={() => onChange({ shapeMode: m })} className={chip(choices.shapeMode === m)}>
                    {t(`create.shapeMode${m.charAt(0).toUpperCase() + m.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {numberInput(choices.rounds, rl, (n) => onChange({ rounds: n }), roundsLabel)}
            {numberInput(choices.timePerRound, tl, (n) => onChange({ timePerRound: n }), timeLabel)}
          </div>
        </div>
      )}
    </div>
  );
}
