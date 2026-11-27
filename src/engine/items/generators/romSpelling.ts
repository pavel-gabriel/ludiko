/**
 * `spelling-pairs` generator (grades V-VIII): choose the correctly written form of a hyphenated
 * pair (s-a / sa, i-au / iau, într-o / intr-o ...) in an original sentence.
 * params: { groups?: string[] }  default: every group
 * The sentences come from content/data/rom/spelling.json; each makes exactly one form right.
 */
import type { FillGapItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { SPELLING, SPELLING_GROUPS, capitalize } from './romGimnaziuData';
import { baseFields, paramStrings, pick, shuffle } from './util';

export const spellingPairs: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const wanted = paramStrings(params, 'groups', Object.keys(SPELLING_GROUPS));
  const pool = SPELLING.filter((e) => wanted.includes(e.g));
  const entry = pick(rng, pool.length ? pool : SPELLING);

  /* a gap at the start of the sentence needs the capital letter */
  const upper = entry.t.startsWith('{{gap}}');
  const fix = (f: string) => (upper ? capitalize(f) : f);
  const forms = SPELLING_GROUPS[entry.g].map(fix);

  const item: FillGapItem = {
    ...baseFields(ctx, {
      ro: 'Completează cu forma scrisă corect.',
      en: 'Fill in the correctly written form.',
    }),
    type: 'fill-gap',
    template: { ro: entry.t, en: entry.t },
    options: shuffle(rng, forms),
    correct: fix(entry.a),
  };
  return item;
};

registerGenerator('spelling-pairs', spellingPairs);
