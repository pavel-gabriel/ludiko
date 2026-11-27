/**
 * Shared kit for the grade V-VIII math generators: answers with exact text forms, a single `build`
 * that turns one verified question into a choice / number-input / fill-gap / true-false item, text
 * helpers (superscripts, signed numbers, Romanian plurals) and a small exact expression evaluator.
 *
 * Conventions (see docs/LEGAL_CONTENT_POLICY.md, all items are original and generated):
 *  - texts shown to the child use the typographic minus "−", the Romanian decimal comma ("2,5") and
 *    "·" for multiplication, ":" for division, "²" "³" ... for exponents;
 *  - the on-screen numpad only types NON-NEGATIVE WHOLE NUMBERS (<= 6 digits), so answers that are
 *    negative, decimal or fractions are always offered as options (choice / fill-gap with options).
 */
import type { ChoiceItem, FillGapItem, Item, LocalizedText, NumberInputItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorContext } from './registry';
import { baseFields, optionCount, shuffle, weighted } from './util';
import { fmt } from './numfmt';
import { MINUS } from './rational';

export { MINUS };

/* ---- text helpers ------------------------------------------------- */

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '−': '⁻',
};

/** "2" -> "²", -3 -> "⁻³" */
export const sup = (n: number | string): string => [...String(n)].map((c) => SUP[c] ?? c).join('');

/** Integer with typographic minus, grouped from 10 000 up ("−1 200") */
export const sInt = (n: number): string => `${n < 0 ? MINUS : ''}${fmt(Math.abs(n))}`;

/** Integer in an expression: negatives in parentheses "(−3)" */
export const pInt = (n: number): string => (n < 0 ? `(${sInt(n)})` : sInt(n));

/** Same text in both languages */
export const both = (s: string): LocalizedText => ({ ro: s, en: s });

export const L = (ro: string, en: string): LocalizedText => ({ ro, en });

/** Romanian "de" rule for counts: "7 elevi", "20 de elevi" */
export const roCount = (n: number, noun: string): string => {
  const r = n % 100;
  return r === 0 || r >= 20 ? `${fmt(n)} de ${noun}` : `${fmt(n)} ${noun}`;
};

export const OP_SYM = { '+': '+', '-': MINUS, '*': '·', '/': ':' } as const;
export type Op = keyof typeof OP_SYM;

/**
 * Evaluate `vals[0] ops[0] vals[1] ...` exactly over the integers.
 *  mode 'prec': usual precedence; 'ltr': strictly left to right (the classic wrong answer).
 * Returns null when a division is not exact (or divides by zero).
 */
export function evalFlat(vals: readonly number[], ops: readonly Op[], mode: 'prec' | 'ltr'): number | null {
  const apply = (a: number, op: Op, b: number): number | null => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (b === 0 || a % b !== 0) return null;
    return a / b;
  };
  if (mode === 'ltr') {
    let acc: number | null = vals[0];
    for (let i = 0; i < ops.length && acc !== null; i++) acc = apply(acc, ops[i], vals[i + 1]);
    return acc;
  }
  const terms: number[] = [vals[0]];
  const adds: Op[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      const r = apply(terms[terms.length - 1], ops[i], vals[i + 1]);
      if (r === null) return null;
      terms[terms.length - 1] = r;
    } else {
      adds.push(ops[i]);
      terms.push(vals[i + 1]);
    }
  }
  let acc = terms[0];
  for (let i = 0; i < adds.length; i++) acc = adds[i] === '+' ? acc + terms[i + 1] : acc - terms[i + 1];
  return acc;
}

/* ---- answers ------------------------------------------------------ */

/** An answer in text form. `int` is set only for plain non-negative integers (can be typed on the numpad). */
export interface Ans {
  ro: string;
  en?: string;
  int?: number;
}

export const aT = (ro: string, en?: string): Ans => ({ ro, ...(en !== undefined ? { en } : {}) });

/** Integer answer; typed-able when non-negative */
export const aInt = (n: number): Ans => (n >= 0 ? { ro: sInt(n), int: n } : { ro: sInt(n) });

const enOf = (a: Ans): string => a.en ?? a.ro;

/* ---- the question spec ------------------------------------------- */

export interface Spec {
  prompt: LocalizedText;
  visual?: VisualSpec;
  answer: Ans;
  /** plausible wrong answers; may contain duplicates / the right answer (filtered out) */
  wrong: Ans[];
  /** wrong answers that should always be offered when possible (the classic mistakes) */
  must?: Ans[];
  /** fill-gap template containing "{{gap}}" */
  gap?: LocalizedText;
  gapPrompt?: LocalizedText;
  /** true-false statement for a given answer (without the "Adevărat sau fals" prefix) */
  tf?: (a: Ans) => LocalizedText;
  /** wrong answers that are certainly different in VALUE (for tf); default: `wrong` */
  tfWrong?: Ans[];
  /** forbid the number-input kind (a typed fill-gap is still allowed) */
  noTyped?: boolean;
  /** kinds to allow, e.g. ['choice'] */
  only?: ('choice' | 'typed' | 'gap' | 'tf')[];
  /** never pad the options with near numbers (selection questions: a near number may also be correct) */
  noPad?: boolean;
}

type Kind = 'choice' | 'typed' | 'gap' | 'tf';

/** Distinct wrong answers (never equal to the right one by text), `must` first */
function wrongPool(s: Spec, rng: () => number): Ans[] {
  const seen = new Set<string>([s.answer.ro]);
  const out: Ans[] = [];
  const add = (a: Ans) => {
    if (seen.has(a.ro)) return;
    seen.add(a.ro);
    out.push(a);
  };
  (s.must ?? []).forEach(add);
  const mustCount = out.length;
  shuffle(rng, s.wrong).forEach(add);
  // integer answers: pad with near numbers so a question always has enough options
  if (s.answer.int !== undefined && !s.noPad && out.length < 4) {
    for (let k = 1; out.length < 4 && k < 50; k++) {
      for (const v of [s.answer.int + k, s.answer.int - k]) if (v >= 0) add(aInt(v));
    }
  }
  return [...out.slice(0, mustCount), ...out.slice(mustCount)];
}

export function build(ctx: GeneratorContext, s: Spec): Item {
  const { rng, difficulty: d } = ctx;
  const pool = wrongPool(s, rng);
  const typedOk = s.answer.int !== undefined && s.answer.int <= 999999;
  const kinds: [Kind, number][] = [['choice', d <= 1 ? 5 : 3]];
  if (typedOk && !s.noTyped) kinds.push(['typed', d <= 1 ? 2 : 4]);
  if (s.gap) kinds.push(['gap', 2]);
  if (s.tf && (s.tfWrong ?? s.wrong).length > 0) kinds.push(['tf', d <= 1 ? 2 : 1]);
  const allowed = s.only ? kinds.filter(([k]) => s.only!.includes(k)) : kinds;
  const kind = weighted(rng, allowed.length ? allowed : kinds);

  const needed = optionCount(d) - 1;
  const choose = (): Ans[] => pool.slice(0, Math.max(2, Math.min(needed, pool.length)));

  switch (kind) {
    case 'typed': {
      const item: NumberInputItem = { ...baseFields(ctx, s.prompt, s.visual), type: 'number-input', correct: s.answer.int as number };
      return item;
    }
    case 'gap': {
      const typed = typedOk && (d >= 2 || pool.length < 2);
      const item: FillGapItem = {
        ...baseFields(ctx, s.gapPrompt ?? s.prompt, s.visual),
        type: 'fill-gap',
        template: s.gap as LocalizedText,
        ...(typed ? {} : { options: shuffle(rng, [s.answer, ...choose()]).map((a) => a.ro) }),
        correct: typed ? String(s.answer.int) : s.answer.ro,
      };
      return item;
    }
    case 'tf': {
      const truth = rng() < 0.5;
      const wrongs = (s.tfWrong ?? s.wrong).filter((a) => a.ro !== s.answer.ro);
      const shown = truth ? s.answer : wrongs[Math.floor(rng() * wrongs.length)];
      const st = (s.tf as (a: Ans) => LocalizedText)(shown);
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Adevărat sau fals: ${st.ro}`, en: `True or false: ${st.en ?? st.ro}` }, s.visual),
        type: 'true-false',
        correct: truth,
      };
      return item;
    }
    default: {
      const picked = shuffle(rng, [s.answer, ...choose()]);
      if (picked.length < 3) throw new Error(`not enough distractors for "${s.prompt.ro}"`);
      const item: ChoiceItem = {
        ...baseFields(ctx, s.prompt, s.visual),
        type: 'choice',
        options: picked.map((a, i) => ({ id: `o${i}`, text: { ro: a.ro, en: enOf(a) } })),
        correctId: `o${picked.indexOf(s.answer)}`,
      };
      return item;
    }
  }
}

/** A true-false item from a statement (the "Adevărat sau fals" prefix is added here) */
export function tfItem(ctx: GeneratorContext, st: LocalizedText, truth: boolean, visual?: VisualSpec): TrueFalseItem {
  return {
    ...baseFields(ctx, { ro: `Adevărat sau fals: ${st.ro}`, en: `True or false: ${st.en ?? st.ro}` }, visual),
    type: 'true-false',
    correct: truth,
  };
}

/** Pick `weighted`-style option from entries by difficulty gating: entries with minD are allowed at d >= minD */
export function gated<T>(rng: () => number, d: number, entries: readonly (readonly [T, number, number?])[]): T {
  return weighted(
    rng,
    entries.filter(([, , minD]) => d >= (minD ?? 1)).map(([v, w]) => [v, w] as const),
  );
}
