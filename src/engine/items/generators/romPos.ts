/**
 * `parts-of-speech` generator (grades V-VIII): name the part of speech of a highlighted word
 * in an original sentence (curated: every word has exactly one defensible label).
 * params: { labels?: string[] }  restricts the words and the answer options
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { POS_ITEMS, POS_LABELS } from './romGimnaziuData';
import { labelChoice, restrictLabels } from './romLabelled';
import { pick } from './util';

export const partsOfSpeech: GeneratorFn = (params, ctx): Item => {
  const labels = restrictLabels(POS_LABELS, params.labels, 4);
  const pool = POS_ITEMS.filter((e) => labels.includes(e.label));
  const e = pick(ctx.rng, pool);
  return labelChoice(
    ctx,
    {
      ro: `În propoziția „${e.s}”, ce parte de vorbire este cuvântul „${e.w}”?`,
      en: `In the sentence “${e.s}”, which part of speech is the word “${e.w}”?`,
    },
    e.label,
    labels,
  );
};

registerGenerator('parts-of-speech', partsOfSpeech);
