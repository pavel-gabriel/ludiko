import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Difficulty, ShapeMode } from '@/utils/types';
import { GAME_TYPES } from '@/utils/constants';
import { PLAY_PRESETS } from '@/components/play/presets';
import { resolveSkillNames } from '@/components/play/skillNames';
import { identityAvatar, identityName } from '@/utils/animalNames';
import {
  isMemory,
  roundsLimits,
  showsShapeMode,
  timeLimits,
  whoIssue,
  type SetupChoices,
  type SetupContext,
  type SetupStep,
} from './setupModel';
import { MODE_EMOJI } from './modes';

interface ReadyStepProps {
  context: SetupContext;
  choices: SetupChoices;
  onChange: (patch: Partial<SetupChoices>) => void;
  onGoTo: (step: SetupStep) => void;
  advanced: boolean;
  onAdvanced: (open: boolean) => void;
}

const chip = (on: boolean) =>
  `flex-1 min-h-[3rem] rounded-xl px-2 py-2 text-base font-bold transition-colors ${
    on ? 'bg-ludiko-purple text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
  }`;

function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <div className="mt-0.5 text-base font-bold leading-snug text-ludiko-text">{children}</div>
      </div>
      <button type="button" onClick={onEdit} aria-label={`${t('setup.change')}: ${label}`} className="min-h-[2.75rem] shrink-0 px-2 text-sm font-bold text-purple-700 underline">
        {t('setup.change')}
      </button>
    </li>
  );
}

/** "Gata?": a short summary (each row jumps back to its step) and the collapsed "Setări avansate" */
export default function ReadyStep({ context, choices, onChange, onGoTo, advanced, onAdvanced }: ReadyStepProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memory = isMemory(choices);
  const sprint = choices.mode === 'sprint';

  /* What we practise, in words */
  let practice: string;
  if (choices.skillIds.length > 0) {
    const preset = PLAY_PRESETS.find((p) => p.skillIds.length === choices.skillIds.length && p.skillIds.every((id) => choices.skillIds.includes(id)));
    practice = preset ? t(preset.labelKey) : resolveSkillNames(choices.skillIds, lang);
  } else {
    const game = memory ? null : GAME_TYPES.find((g) => g.type === choices.classicType);
    practice = game ? `${t('setup.practice.classic')}: ${t(game.labelKey)}` : t('setup.practice.classic');
  }

  const players =
    context === 'duel'
      ? [choices.identity, choices.identity2]
      : [choices.identity];

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
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100 rounded-2xl bg-white px-4 shadow" aria-label={t('setup.step.ready')}>
        <Row label={t('setup.summary.game')} onEdit={() => onGoTo('mode')}>
          <span aria-hidden="true">{MODE_EMOJI[choices.mode]} </span>
          {t(`setup.mode.${choices.mode}.title`)}
        </Row>
        <Row label={t('setup.summary.practice')} onEdit={() => onGoTo('practice')}>
          <span className="line-clamp-2">{practice}</span>
        </Row>
        <Row label={t(context === 'duel' ? 'setup.summary.players' : 'setup.summary.player')} onEdit={() => onGoTo('who')}>
          {players.map((id) => (
            <span key={`${id.animal}-${id.adjective}`} className="block truncate">
              <span aria-hidden="true">{identityAvatar(id)} </span>
              {identityName(id, lang)}
            </span>
          ))}
        </Row>
      </ul>

      {whoIssue(context, choices) && (
        <p role="alert" className="text-center text-sm font-semibold text-red-600">
          {t('interactive.differentAvatars')}
        </p>
      )}

      {/* Advanced settings (collapsed): rounds, time, difficulty, shape mode */}
      <div>
        <button
          type="button"
          onClick={() => onAdvanced(!advanced)}
          aria-expanded={advanced}
          className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-gray-600"
        >
          {t('setup.advanced')} <span aria-hidden="true">{advanced ? '▴' : '▾'}</span>
        </button>
        {advanced && (
          <div className="mt-2 space-y-4 rounded-2xl bg-white p-4 shadow">
            {!(context === 'duel' && memory) && (
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
    </div>
  );
}
