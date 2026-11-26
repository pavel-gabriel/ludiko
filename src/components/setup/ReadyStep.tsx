import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_TYPES } from '@/utils/constants';
import { PLAY_PRESETS } from '@/components/play/presets';
import { resolveSkillNames } from '@/components/play/skillNames';
import { identityAvatar, identityName } from '@/utils/animalNames';
import {
  isMemory,
  whoIssue,
  type SetupChoices,
  type SetupContext,
  type SetupStep,
} from './setupModel';
import { MODE_EMOJI } from './modes';
import AdvancedSettings from './AdvancedSettings';

interface ReadyStepProps {
  context: SetupContext;
  choices: SetupChoices;
  onChange: (patch: Partial<SetupChoices>) => void;
  onGoTo: (step: SetupStep) => void;
  advanced: boolean;
  onAdvanced: (open: boolean) => void;
}

export function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
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

  /* What we practise, in words */
  let practice: string;
  if (choices.skillIds.length > 0) {
    const preset = PLAY_PRESETS.find((p) => p.skillIds.length === choices.skillIds.length && p.skillIds.every((id) => choices.skillIds.includes(id)));
    practice = preset ? t(preset.labelKey) : resolveSkillNames(choices.skillIds, lang);
  } else {
    const game = GAME_TYPES.find((g) => g.type === choices.classicType);
    practice = game ? `${t('setup.practice.classic')}: ${t(game.labelKey)}` : t('setup.practice.classic');
  }

  const players =
    context === 'duel'
      ? [choices.identity, choices.identity2]
      : [choices.identity];

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100 rounded-2xl bg-white px-4 shadow" aria-label={t('setup.step.ready')}>
        <Row label={t('setup.summary.game')} onEdit={() => onGoTo('mode')}>
          <span aria-hidden="true">{MODE_EMOJI[choices.mode]} </span>
          {t(`setup.mode.${choices.mode}.title`)}
        </Row>
        {!memory && (
          <Row label={t('setup.summary.practice')} onEdit={() => onGoTo('practice')}>
            <span className="line-clamp-2">{practice}</span>
          </Row>
        )}
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

      <AdvancedSettings context={context} choices={choices} onChange={onChange} open={advanced} onToggle={onAdvanced} />
    </div>
  );
}
