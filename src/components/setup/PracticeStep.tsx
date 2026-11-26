import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Grade } from '@/engine/types';
import type { Operation } from '@/utils/types';
import { GAME_TYPES } from '@/utils/constants';
import SkillPicker from '@/components/play/SkillPicker';
import { PLAY_PRESETS } from '@/components/play/presets';
import { skillUsable } from '@/services/itemGame';
import { resolveSkillNames } from '@/components/play/skillNames';
import OptionCard from './OptionCard';
import {
  CLASSIC_TYPES,
  itemKindOf,
  practiceIssue,
  presetsForGrade,
  starterPresets,
  unplayableSkills,
  type SetupChoices,
} from './setupModel';

interface PracticeStepProps {
  choices: SetupChoices;
  onChange: (patch: Partial<SetupChoices>) => void;
  /** Grade of the active profile (presets are filtered to it); null without a profile */
  grade: Grade | null;
  showAll: boolean;
  onShowAll: (all: boolean) => void;
  picking: boolean;
  onPicking: (open: boolean) => void;
}

/** Presets shown before "Arată toate" */
const PRESETS_SHOWN = 6;

const chip = (on: boolean) =>
  `min-h-[3rem] rounded-xl px-3 py-2 text-base font-bold transition-colors ${
    on ? 'bg-ludiko-purple text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
  }`;

/** "Ce exersăm?": grade-filtered quick presets, "Alege singur" (the skill picker) or "Jocul clasic" (v1 games) */
export default function PracticeStep({ choices, onChange, grade, showAll, onShowAll, picking, onPicking }: PracticeStepProps) {
  const { t, i18n } = useTranslation();
  const kind = itemKindOf(choices.mode);
  const filtered = grade !== null && !showAll;
  /* a short list first (for the child's grade when there is a profile); "Arată toate" opens the rest */
  const base = useMemo(() => (grade !== null ? presetsForGrade(grade) : starterPresets()), [grade]);
  const presets = showAll ? [...PLAY_PRESETS] : base.slice(0, PRESETS_SHOWN);
  const canToggle = base.length > PRESETS_SHOWN || base.length < PLAY_PRESETS.length;
  const issue = practiceIssue(choices);
  const unplayable = unplayableSkills(choices);

  const toggleOp = (op: Operation) =>
    onChange({
      operations: choices.operations.includes(op) ? choices.operations.filter((o) => o !== op) : [...choices.operations, op],
    });

  return (
    <div className="space-y-3">
      {(grade !== null || canToggle) && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ludiko-text">
            {filtered ? t('setup.practice.forGrade', { grade: t(`profiles.gradeLabels.${grade}`) }) : showAll ? t('setup.practice.allPresets') : ''}
          </p>
          {canToggle && (
            <button type="button" onClick={() => onShowAll(!showAll)} className="ml-auto min-h-[2.75rem] px-2 text-sm font-bold text-gray-600 underline">
              {showAll ? (grade !== null ? t('setup.practice.onlyMine') : t('setup.practice.fewer')) : t('setup.practice.showAll')}
            </button>
          )}
        </div>
      )}

      {issue === 'none' && (
        <p className="text-sm font-semibold text-gray-600" aria-live="polite">
          {t('setup.practice.chooseOne')}
        </p>
      )}

      {/* Quick presets */}
      <div className="grid grid-cols-2 gap-3" role="group" aria-label={t('play.presets')}>
        {presets.map((p) => {
          const ids = p.skillIds.filter((id) => skillUsable(id, kind));
          const on = ids.length > 0 && ids.length === choices.skillIds.length && ids.every((id) => choices.skillIds.includes(id));
          return (
            <OptionCard
              key={p.id}
              layout="tile"
              emoji={p.emoji}
              title={t(p.labelKey)}
              tone="green"
              selected={on}
              disabled={ids.length === 0}
              onClick={() => {
                onPicking(false);
                onChange(on ? { skillIds: [] } : { skillIds: ids, classic: false });
              }}
            />
          );
        })}
      </div>

      {/* Pick the skills yourself */}
      <OptionCard
        emoji="🔎"
        title={t('setup.practice.pick')}
        sub={t('setup.practice.pickSub')}
        tone="blue"
        dashed
        selected={picking}
        onClick={() => {
          onPicking(!picking);
          if (!picking) onChange({ classic: false });
        }}
      />
      {picking && (
        <div className="rounded-2xl bg-white p-3 shadow">
          <SkillPicker value={choices.skillIds} onChange={(ids) => onChange({ skillIds: ids, classic: false })} kind={kind} embedded initialGrade={grade ?? undefined} />
        </div>
      )}

      {/* Classic v1 games */}
      <OptionCard
        emoji="🎮"
        title={t('setup.practice.classic')}
        sub={t('setup.practice.classicSub')}
        tone="yellow"
        selected={choices.classic}
        onClick={() => {
          onPicking(false);
          onChange(choices.classic ? { classic: false } : { classic: true, skillIds: [] });
        }}
      />
      {choices.classic && (
        <div className="space-y-3 rounded-2xl bg-white p-3 shadow">
          <div role="group" aria-label={t('setup.practice.classicGame')}>
            <span className="text-sm font-semibold">{t('setup.practice.classicGame')}</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {GAME_TYPES.filter((g) => CLASSIC_TYPES.includes(g.type)).map((g) => (
                <button
                  key={g.type}
                  type="button"
                  aria-pressed={choices.classicType === g.type}
                  onClick={() => onChange({ classicType: g.type })}
                  className={chip(choices.classicType === g.type)}
                >
                  <span aria-hidden="true">{g.emoji} </span>
                  {t(g.labelKey)}
                </button>
              ))}
            </div>
          </div>
          {(choices.classicType === 'mathRace' || choices.classicType === 'equations') && (
            <div role="group" aria-label={t('create.operations')}>
              <span className="text-sm font-semibold">{t('create.operations')}</span>
              <div className="mt-1 flex gap-2">
                {(['+', '-', '×', '÷'] as Operation[]).map((op) => (
                  <button
                    key={op}
                    type="button"
                    aria-pressed={choices.operations.includes(op)}
                    onClick={() => toggleOp(op)}
                    className={`flex-1 min-h-[3rem] rounded-xl text-2xl font-bold transition-colors ${
                      choices.operations.includes(op) ? 'bg-ludiko-green text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* What blocks "Înainte" */}
      <div aria-live="polite">
        {issue === 'unplayable' && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {t('play.unplayable', { names: resolveSkillNames(unplayable, i18n.language) })}
          </p>
        )}
        {issue === 'operations' && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {t('setup.practice.operationsNeeded')}
          </p>
        )}
      </div>
    </div>
  );
}
