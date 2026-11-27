import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllSkills } from '@/engine/content/registry';
import { localize, type Grade, type Skill, type SubjectId } from '@/engine/types';
import { MAX_SKILLS, skillUsable, type ItemGameKind } from '@/services/itemGame';
import { PLAY_PRESETS } from './presets';

interface SkillPickerProps {
  /** Chosen skill ids (max MAX_SKILLS) */
  value: string[];
  onChange: (ids: string[]) => void;
  /** The game the skills will be played in: skills that make no sense there are disabled */
  kind: ItemGameKind;
  /**
   * Inside the setup wizard ("Alege singur"): only the chosen list and the subject -> grade -> skills
   * lists, always open. The title and the quick presets are the wizard's own step then.
   */
  embedded?: boolean;
  /** Grade list to open first (the child's grade); defaults to the first grade of the subject */
  initialGrade?: Grade;
}

const SUBJECT_ORDER: SubjectId[] = ['mat', 'rom', 'eng', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim'];

const chip = (on: boolean) =>
  `rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
    on ? 'bg-ludiko-purple text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
  }`;

/**
 * "Ce exersăm?": quick presets, or subject -> grade -> skills (multi-select, up to MAX_SKILLS).
 * Shared by the room, single-player and duel setup pages. Choosing nothing keeps the classic v1 game.
 */
export default function SkillPicker({ value, onChange, kind, embedded = false, initialGrade }: SkillPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [openState, setOpen] = useState(false);
  const open = embedded || openState;

  const skills = useMemo(() => getAllSkills(), []);
  const subjects = useMemo(
    () => SUBJECT_ORDER.filter((s) => skills.some((k) => k.subject === s)),
    [skills],
  );
  const [subject, setSubject] = useState<SubjectId>(subjects[0] ?? 'mat');
  const grades = useMemo(
    () => [...new Set(skills.filter((s) => s.subject === subject).map((s) => s.grade))].sort((a, b) => a - b) as Grade[],
    [skills, subject],
  );
  const [grade, setGrade] = useState<Grade>(initialGrade ?? grades[0] ?? 0);
  const shownGrade = grades.includes(grade) ? grade : (grades[0] ?? 0);
  const list = useMemo(
    () => skills.filter((s) => s.subject === subject && s.grade === shownGrade),
    [skills, subject, shownGrade],
  );

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const name = (s: Skill) => localize(s.title, lang);
  const full = value.length >= MAX_SKILLS;

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!full) onChange([...value, id]);
  };

  return (
    <section aria-label={t('play.title')} className={embedded ? '' : 'mb-4'}>
      {!embedded && (
        <>
          <span className="text-sm font-semibold">{t('play.title')}</span>
          <p className="text-xs text-gray-500 mt-0.5">{t('play.hint', { max: MAX_SKILLS })}</p>
        </>
      )}

      {/* Quick presets */}
      {!embedded && (
      <div className="mt-2">
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
          {t('play.presets')}
        </span>
        <div className="flex flex-wrap gap-2">
          {PLAY_PRESETS.map((p) => {
            const ids = p.skillIds.filter((id) => skillUsable(id, kind));
            const on = ids.length > 0 && ids.length === value.length && ids.every((id) => value.includes(id));
            return (
              <button
                key={p.id}
                type="button"
                disabled={ids.length === 0}
                aria-pressed={on}
                onClick={() => onChange(on ? [] : ids)}
                className={`${chip(on)} disabled:opacity-40`}
              >
                <span aria-hidden="true">{p.emoji} </span>
                {t(p.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* What is chosen */}
      {value.length > 0 && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ludiko-purple">
              {t('play.chosen', { n: value.length, max: MAX_SKILLS })}
            </span>
            <button type="button" onClick={() => onChange([])} className="text-xs font-bold text-gray-500 underline">
              {t('play.clear')}
            </button>
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {value.map((id) => {
              const s = byId.get(id);
              if (!s) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={t('play.remove', { name: name(s) })}
                    className="max-w-[16rem] truncate rounded-full bg-ludiko-purple/15 px-3 py-1 text-xs font-bold text-ludiko-text"
                  >
                    {name(s)} <span aria-hidden="true">✕</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pick yourself: subject -> grade -> skills */}
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-ludiko-blue py-2 text-sm font-bold text-ludiko-text"
        >
          {open ? t('play.hidePicker') : t('play.pickYourself')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <div role="group" aria-label={t('play.subject')} className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={chip(subject === s)}>
                {t(`play.subjects.${s}`)}
              </button>
            ))}
          </div>

          <div role="group" aria-label={t('play.grade')} className="flex flex-wrap gap-2">
            {grades.map((g) => (
              <button key={g} type="button" aria-pressed={shownGrade === g} onClick={() => setGrade(g)} className={chip(shownGrade === g)}>
                {t(`play.grades.${g}`)}
              </button>
            ))}
          </div>

          {full && <p className="text-xs font-semibold text-amber-700">{t('play.maxReached', { max: MAX_SKILLS })}</p>}

          {list.length === 0 ? (
            <p className="text-sm text-gray-500">{t('play.noSkills')}</p>
          ) : (
            <ul className="space-y-1.5" aria-label={t('play.title')}>
              {list.map((s) => {
                const on = value.includes(s.id);
                const playable = skillUsable(s.id, kind);
                const blocked = !playable || (!on && full);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={blocked && !on}
                      onClick={() => toggle(s.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        on ? 'bg-ludiko-green text-ludiko-text' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <span aria-hidden="true">{on ? '✓ ' : ''}</span>
                      {name(s)}
                      {!playable && <span className="block text-xs font-normal text-gray-500">{t('play.notPlayable')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
