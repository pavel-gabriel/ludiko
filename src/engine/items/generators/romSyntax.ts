/**
 * `syntax-roles` generator (grades VII-VIII).
 * params: { kinds?: ('role' | 'clause' | 'subordinate')[], labels?: string[] }
 *   role         the syntactic function of a highlighted word/group (subject, predicate, attribute, complements)
 *   clause       coordination vs subordination in a complex sentence, or how many clauses it has
 *   subordinate  the kind of a subordinate clause (subjective, attributive, completive, adverbial)
 * `labels` restricts the roles (words and options). Sentences are curated: one defensible label each.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorContext, type GeneratorFn } from './registry';
import { FRAZA_ITEMS, ROLE_ITEMS, ROLE_LABELS, SUBORD_ITEMS, SUBORD_LABELS } from './romGimnaziuData';
import { labelChoice, restrictLabels } from './romLabelled';
import { baseFields, optionCount, paramStrings, pick, shuffle } from './util';

type Kind = 'role' | 'clause' | 'subordinate';
const KINDS: Kind[] = ['role', 'clause', 'subordinate'];

function clauseItem(ctx: GeneratorContext): ChoiceItem {
  const { rng, difficulty } = ctx;
  const e = pick(rng, FRAZA_ITEMS);
  if (rng() < 0.5) {
    return labelChoice(
      ctx,
      {
        ro: `Cum sunt legate propozițiile din fraza „${e.s}”?`,
        en: `How are the clauses of the sentence “${e.s}” linked?`,
      },
      e.relation,
      ['coordonare', 'subordonare'],
    );
  }
  const answer = `${e.clauses} propoziții`;
  const pool = [2, 3, 4, 5].map((n) => `${n} propoziții`);
  const count = Math.min(optionCount(difficulty), pool.length);
  const wrong = shuffle(
    rng,
    pool.filter((x) => x !== answer),
  ).slice(0, count - 1);
  return {
    ...baseFields(ctx, {
      ro: `Câte propoziții are fraza „${e.s}”?`,
      en: `How many clauses does the sentence “${e.s}” have?`,
    }),
    type: 'choice',
    options: shuffle(rng, [answer, ...wrong]).map((l) => ({ id: `n_${l.split(' ')[0]}`, text: { ro: l } })),
    correctId: `n_${e.clauses}`,
  };
}

export const syntaxRoles: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const kinds = paramStrings(params, 'kinds', ['role']).filter((k): k is Kind => KINDS.includes(k as Kind));
  const kind = pick(rng, kinds.length ? kinds : (['role'] as Kind[]));

  if (kind === 'clause') return clauseItem(ctx);

  if (kind === 'subordinate') {
    const e = pick(rng, SUBORD_ITEMS);
    return labelChoice(
      ctx,
      {
        ro: `În fraza „${e.s}”, ce fel de propoziție subordonată este „${e.clause}”?`,
        en: `In the sentence “${e.s}”, what kind of subordinate clause is “${e.clause}”?`,
      },
      e.label,
      SUBORD_LABELS,
    );
  }

  const labels = restrictLabels(ROLE_LABELS, params.labels, 3);
  const e = pick(
    rng,
    ROLE_ITEMS.filter((x) => labels.includes(x.label)),
  );
  return labelChoice(
    ctx,
    {
      ro: `În propoziția „${e.s}”, ce funcție sintactică are „${e.w}”?`,
      en: `In the sentence “${e.s}”, what is the syntactic function of “${e.w}”?`,
    },
    e.label,
    labels,
  );
};

registerGenerator('syntax-roles', syntaxRoles);
