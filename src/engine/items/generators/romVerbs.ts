/**
 * `verb-forms` generator (grades VI-VIII): recognise the person/number, tense or mood of a
 * highlighted verb form in an original sentence.
 * params: { kinds?: ('person' | 'tense' | 'mood')[] }  default: all three
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { VERB_ITEMS, VERB_LABELS, type VerbKind } from './romGimnaziuData';
import { labelChoice } from './romLabelled';
import { paramStrings, pick } from './util';

const KINDS: VerbKind[] = ['person', 'tense', 'mood'];

const ASK: Record<VerbKind, (s: string, w: string) => { ro: string; en: string }> = {
  person: (s, w) => ({
    ro: `În propoziția „${s}”, ce persoană și ce număr are verbul „${w}”?`,
    en: `In the sentence “${s}”, which person and number is the verb “${w}”?`,
  }),
  tense: (s, w) => ({
    ro: `În propoziția „${s}”, la ce timp este verbul „${w}”?`,
    en: `In the sentence “${s}”, which tense is the verb “${w}”?`,
  }),
  mood: (s, w) => ({
    ro: `În propoziția „${s}”, la ce mod este verbul „${w}”?`,
    en: `In the sentence “${s}”, which mood is the verb “${w}”?`,
  }),
};

export const verbForms: GeneratorFn = (params, ctx): Item => {
  const kinds = paramStrings(params, 'kinds', KINDS).filter((k): k is VerbKind => KINDS.includes(k as VerbKind));
  const kind = pick(ctx.rng, kinds.length ? kinds : KINDS);
  const e = pick(
    ctx.rng,
    VERB_ITEMS.filter((x) => x.kind === kind),
  );
  return labelChoice(ctx, ASK[kind](e.s, e.w), e.label, VERB_LABELS[kind]);
};

registerGenerator('verb-forms', verbForms);
