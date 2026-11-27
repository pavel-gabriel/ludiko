/**
 * `figures-of-speech` generator (grades V-VIII): name the figure of speech in an original line.
 * params: { figures?: string[] }  restricts the lines and the answer options
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { FIGURE_ITEMS, FIGURE_LABELS } from './romGimnaziuData';
import { labelChoice, restrictLabels } from './romLabelled';
import { pick } from './util';

export const figuresOfSpeech: GeneratorFn = (params, ctx): Item => {
  const labels = restrictLabels(FIGURE_LABELS, params.figures, 3);
  const e = pick(
    ctx.rng,
    FIGURE_ITEMS.filter((x) => labels.includes(x.figure)),
  );
  return labelChoice(
    ctx,
    {
      ro: `Ce figură de stil apare în enunțul: „${e.line}”?`,
      en: `Which figure of speech appears in the line: “${e.line}”?`,
    },
    e.figure,
    labels,
  );
};

registerGenerator('figures-of-speech', figuresOfSpeech);
