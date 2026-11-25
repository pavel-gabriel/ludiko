/**
 * `money` generator (params: kinds, maxLei, bani, max). Money visuals are GENERIC coins and notes
 * drawn by the visual kit (amounts in bani; values < 100 are coins, from 100 up notes).
 *  - total:   how much money is shown (choice / number-input)
 *  - pay:     which pieces make exactly the price (picture-choice)
 *  - sum:     two prices added together (number-input / choice)
 *  - change:  pay with a bigger amount, how much comes back (choice / number-input)
 *  - compare: which amount is bigger (picture-choice / choice / true-false)
 *  - convert: lei <-> bani (fill-gap)
 * `maxLei` caps the amounts, `bani` allows amounts with bani, `max` bounds numeric answers.
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, NumberInputItem, PictureChoiceItem, TrueFalseItem } from '../../types';
import type { GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, optionCount, paramBool, paramInt, paramStrings, pick, randInt, shuffle, weighted } from './util';
import { baniText, leiText, moneyText, stringOptions, textOptions } from './measureText';

type Kind = 'total' | 'pay' | 'sum' | 'change' | 'compare' | 'convert';

const LEI_DENOMS = [1, 5, 10, 50, 100].map((v) => v * 100);
const BANI_DENOMS = [1, 5, 10, 50];

const SHOP: { ro: string; en: string }[] = [
  { ro: 'un caiet', en: 'a notebook' },
  { ro: 'o carte', en: 'a book' },
  { ro: 'o minge', en: 'a ball' },
  { ro: 'o înghețată', en: 'an ice cream' },
  { ro: 'un pix', en: 'a pen' },
  { ro: 'o jucărie', en: 'a toy' },
  { ro: 'un suc', en: 'a juice' },
  { ro: 'o ciocolată', en: 'a chocolate bar' },
  { ro: 'o carte de colorat', en: 'a colouring book' },
  { ro: 'un joc', en: 'a game' },
];

/** Split an amount into pieces from `denoms` (randomly, at most `limit` pieces, else greedy). */
function pieces(rng: Rng, total: number, denoms: number[], limit = 6): number[] {
  const out: number[] = [];
  let left = total;
  while (left > 0 && out.length < limit - 1) {
    const fit = denoms.filter((v) => v <= left);
    if (!fit.length) break;
    const v = chance(rng, 0.55) ? Math.max(...fit) : pick(rng, fit);
    out.push(v);
    left -= v;
  }
  const sorted = [...denoms].sort((a, b) => b - a);
  while (left > 0) {
    const v = sorted.find((x) => x <= left)!;
    out.push(v);
    left -= v;
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const visual = (amounts: number[]) => ({ kind: 'money' as const, amounts });

interface Cfg {
  maxBani: number;
  bani: boolean;
  /** pieces allowed in visuals */
  denoms: number[];
  /** also show coin-only (bani) amounts below 1 leu */
  coins: boolean;
}

/** A money visual with a random sum within the config (whole lei unless `bani`). */
function randomPieces(rng: Rng, cfg: Cfg, d: number): number[] {
  for (let t = 0; t < 40; t++) {
    const n = randInt(rng, 2, Math.min(5, 2 + d));
    const ps = Array.from({ length: n }, () => pick(rng, cfg.denoms));
    if (sum(ps) <= cfg.maxBani) return ps;
  }
  return [pick(rng, cfg.denoms.filter((v) => v <= cfg.maxBani))];
}

function totalItem(ctx: Parameters<GeneratorFn>[1], cfg: Cfg): Item {
  const { rng, difficulty: d } = ctx;
  const coinMode = cfg.coins && chance(rng, 0.4);
  let ps: number[];
  if (coinMode) {
    ps = [];
    for (let t = 0; t < 60 && (ps.length < 2 || sum(ps) >= 100); t++) {
      ps = Array.from({ length: randInt(rng, 2, 3 + Math.min(d, 2)) }, () => pick(rng, BANI_DENOMS));
    }
    if (sum(ps) >= 100) ps = [10, 5];
  } else ps = randomPieces(rng, cfg, d);
  const S = sum(ps);
  const spec = visual(ps);
  const whole = S % 100 === 0;
  const onlyBani = S < 100;
  const wrongSums = [S + 100, S - 100, S + 500, S - 500, S + 10, S - 10, S + 50, S - 50, S + 5, S - 5, S + 1, S - 1, sum(ps.map((p) => (p >= 100 ? p / 100 : 1)))]
    .filter((x) => x > 0 && x !== S && (coinMode ? x < 100 : cfg.bani || x % 100 === 0));
  if ((whole || onlyBani) && chance(rng, 0.4)) {
    const value = whole ? S / 100 : S;
    const item: NumberInputItem = {
      ...baseFields(
        ctx,
        whole ? { ro: 'Câți lei sunt în total?', en: 'How many lei are there in total?' } : { ro: 'Câți bani sunt în total?', en: 'How many bani are there in total?' },
        spec,
      ),
      type: 'number-input',
      correct: value,
    };
    return item;
  }
  const { options, correctId } = textOptions(rng, moneyText(S), wrongSums.map(moneyText), optionCount(d));
  const item: ChoiceItem = {
    ...baseFields(ctx, { ro: 'Cât fac în total banii din imagine?', en: 'How much money is there in total?' }, spec),
    type: 'choice',
    options,
    correctId,
  };
  return item;
}

function payItem(ctx: Parameters<GeneratorFn>[1], cfg: Cfg): Item {
  const { rng, difficulty: d } = ctx;
  const unit = cfg.bani && chance(rng, 0.5) ? 5 : 100;
  const cap = unit === 5 ? Math.min(cfg.maxBani, 1000) : cfg.maxBani;
  const P = unit * randInt(rng, 2, Math.max(3, Math.floor(cap / unit)));
  const right = pieces(rng, P, cfg.denoms);
  const total = optionCount(d);
  const seen = new Set<number>([P]);
  const opts: { total: number; ps: number[] }[] = [{ total: P, ps: right }];
  const deltas = shuffle(rng, [unit, -unit, 2 * unit, -2 * unit, unit * 5, -unit * 5, 10 * unit]);
  for (const dl of deltas) {
    const T = P + dl;
    if (opts.length >= total) break;
    if (T <= 0 || T > cfg.maxBani * 2 || seen.has(T) || (!cfg.bani && T % 100 !== 0)) continue;
    seen.add(T);
    opts.push({ total: T, ps: pieces(rng, T, cfg.denoms) });
  }
  const price = moneyText(P);
  const item: PictureChoiceItem = {
    ...baseFields(ctx, { ro: `Care dintre grupuri face exact ${price.ro}?`, en: `Which group makes exactly ${price.en}?` }),
    type: 'picture-choice',
    options: shuffle(rng, opts).map((o) => ({ id: `p${o.total}`, visual: visual(o.ps) })),
    correctId: `p${P}`,
  };
  return item;
}

function sumItem(ctx: Parameters<GeneratorFn>[1], cfg: Cfg): Item {
  const { rng, difficulty: d } = ctx;
  const step = cfg.bani ? 50 : 100;
  const half = Math.floor(cfg.maxBani / 2 / step);
  const a = step * randInt(rng, 1, Math.max(1, half));
  const b = step * randInt(rng, 1, Math.max(1, half));
  const [t1, t2] = shuffle(rng, SHOP).slice(0, 2);
  const S = a + b;
  const q = {
    ro: `${capital(t1.ro)} costă ${moneyText(a).ro}, iar ${t2.ro} costă ${moneyText(b).ro}. Cât costă amândouă la un loc?`,
    en: `${capital(t1.en)} costs ${moneyText(a).en} and ${t2.en} costs ${moneyText(b).en}. How much do both cost together?`,
  };
  if (S % 100 === 0 && chance(rng, 0.5)) {
    const item: NumberInputItem = { ...baseFields(ctx, { ro: `${q.ro} (în lei)`, en: `${q.en} (in lei)` }), type: 'number-input', correct: S / 100 };
    return item;
  }
  const wrong = [S + step, S - step, a, b, Math.abs(a - b), S + 100, S - 100, S + 1000].filter((x) => x > 0 && x !== S && (cfg.bani || x % 100 === 0));
  const { options, correctId } = textOptions(rng, moneyText(S), wrong.map(moneyText), optionCount(d));
  const item: ChoiceItem = { ...baseFields(ctx, q), type: 'choice', options, correctId };
  return item;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function changeItem(ctx: Parameters<GeneratorFn>[1], cfg: Cfg): Item {
  const { rng, difficulty: d } = ctx;
  const given = pick(rng, [500, 1000, 2000, 5000, 10000].filter((v) => v <= Math.max(500, cfg.maxBani)));
  const step = cfg.bani ? 50 : 100;
  const price = step * randInt(rng, 1, Math.floor(given / step) - 1);
  const rest = given - price;
  const thing = pick(rng, SHOP);
  const q = {
    ro: `Ana are ${moneyText(given).ro} și cumpără ${thing.ro} de ${moneyText(price).ro}. Cât rest primește?`,
    en: `Ana has ${moneyText(given).en} and buys ${thing.en} for ${moneyText(price).en}. How much change does she get?`,
  };
  const spec = visual([given]);
  if (rest % 100 === 0 && chance(rng, 0.45)) {
    const item: NumberInputItem = { ...baseFields(ctx, { ro: `${q.ro} (în lei)`, en: `${q.en} (in lei)` }, spec), type: 'number-input', correct: rest / 100 };
    return item;
  }
  const wrong = [rest + step, rest - step, rest + 100, rest - 100, price, given + price, Math.abs(rest - 1000), rest + 1000].filter(
    (x) => x > 0 && x !== rest && (cfg.bani || x % 100 === 0),
  );
  const { options, correctId } = textOptions(rng, moneyText(rest), wrong.map(moneyText), optionCount(d));
  const item: ChoiceItem = { ...baseFields(ctx, q, spec), type: 'choice', options, correctId };
  return item;
}

function compareItem(ctx: Parameters<GeneratorFn>[1], cfg: Cfg): Item {
  const { rng, difficulty: d } = ctx;
  const more = chance(rng, 0.5);
  const mode = weighted<'visual' | 'text' | 'tf'>(rng, [['visual', 40], ['text', 30], ['tf', 30]]);
  if (mode === 'visual') {
    let a: number[] = [];
    let b: number[] = [];
    for (let t = 0; t < 40 && sum(a) === sum(b); t++) {
      a = randomPieces(rng, cfg, d);
      b = randomPieces(rng, cfg, d);
    }
    if (sum(a) === sum(b)) b = [...b, cfg.denoms[0]];
    const best = more ? (sum(a) > sum(b) ? a : b) : sum(a) < sum(b) ? a : b;
    const item: PictureChoiceItem = {
      ...baseFields(
        ctx,
        more ? { ro: 'Unde sunt mai mulți bani?', en: 'Where is there more money?' } : { ro: 'Unde sunt mai puțini bani?', en: 'Where is there less money?' },
      ),
      type: 'picture-choice',
      options: [a, b].map((ps) => ({ id: `p${sum(ps)}`, visual: visual(ps) })),
      correctId: `p${sum(best)}`,
    };
    return item;
  }
  const step = cfg.bani ? 50 : 100;
  const vals = new Set<number>();
  while (vals.size < (mode === 'tf' ? 2 : 3)) vals.add(step * randInt(rng, 1, Math.max(3, Math.floor(cfg.maxBani / step))));
  const list = shuffle(rng, [...vals]);
  if (mode === 'tf') {
    const [x, y] = list;
    const item: TrueFalseItem = {
      ...baseFields(ctx, { ro: `Adevărat sau fals: ${moneyText(x).ro} sunt mai mult decât ${moneyText(y).ro}.`, en: `True or false: ${moneyText(x).en} is more than ${moneyText(y).en}.` }),
      type: 'true-false',
      correct: x > y,
    };
    return item;
  }
  const best = more ? Math.max(...list) : Math.min(...list);
  const options: CardContent[] = list.map((v) => ({ id: `m${v}`, text: moneyText(v) }));
  const item: ChoiceItem = {
    ...baseFields(ctx, more ? { ro: 'Care sumă este mai mare?', en: 'Which amount is bigger?' } : { ro: 'Care sumă este mai mică?', en: 'Which amount is smaller?' }),
    type: 'choice',
    options,
    correctId: `m${best}`,
  };
  return item;
}

function convertItem(ctx: Parameters<GeneratorFn>[1]): Item {
  const { rng, difficulty: d } = ctx;
  const mode = weighted<'leiToBani' | 'baniToLei' | 'mixed'>(rng, [['leiToBani', 40], ['baniToLei', 30], ['mixed', 30]]);
  if (mode === 'leiToBani') {
    const lei = randInt(rng, 1, d >= 3 ? 9 : 5);
    const item: FillGapItem = {
      ...baseFields(ctx, { ro: 'Transformă în bani.', en: 'Convert to bani.' }),
      type: 'fill-gap',
      template: { ro: `${leiText(lei).ro} = {{gap}} (bani)`, en: `${leiText(lei).en} = {{gap}} (bani)` },
      options: stringOptions(rng, String(lei * 100), [lei * 10, lei * 1000, lei * 100 + 10, lei * 50, (lei + 1) * 100].map(String), optionCount(d)),
      correct: String(lei * 100),
    };
    return item;
  }
  if (mode === 'baniToLei') {
    const lei = randInt(rng, 1, d >= 3 ? 9 : 5);
    const item: FillGapItem = {
      ...baseFields(ctx, { ro: 'Transformă în lei.', en: 'Convert to lei.' }),
      type: 'fill-gap',
      template: { ro: `${baniText(lei * 100).ro} = {{gap}} (lei)`, en: `${baniText(lei * 100).en} = {{gap}} (lei)` },
      options: stringOptions(rng, String(lei), [lei * 10, lei + 1, Math.max(1, lei - 1), lei * 100, lei + 10].map(String), optionCount(d)),
      correct: String(lei),
    };
    return item;
  }
  const lei = randInt(rng, 1, 5);
  const bani = pick(rng, [10, 20, 25, 50, 75]);
  const item: NumberInputItem = {
    ...baseFields(ctx, { ro: `Câți bani sunt în ${moneyText(lei * 100 + bani).ro}?`, en: `How many bani are in ${moneyText(lei * 100 + bani).en}?` }),
    type: 'number-input',
    correct: lei * 100 + bani,
  };
  return item;
}

export const money: GeneratorFn = (params, ctx): Item => {
  const cfg: Cfg = {
    maxBani: paramInt(params, 'maxLei', 20) * 100,
    bani: paramBool(params, 'bani') ?? false,
    denoms: [],
    coins: paramBool(params, 'coins') ?? false,
  };
  cfg.denoms = [...(cfg.bani ? BANI_DENOMS : []), ...LEI_DENOMS.filter((v) => v <= cfg.maxBani)];
  const kinds = paramStrings(params, 'kinds', ['total', 'pay', 'compare']) as Kind[];
  const kind = weighted<Kind>(ctx.rng, kinds.map((k) => [k, 1] as const));
  switch (kind) {
    case 'total':
      return totalItem(ctx, cfg);
    case 'pay':
      return payItem(ctx, cfg);
    case 'sum':
      return sumItem(ctx, cfg);
    case 'change':
      return changeItem(ctx, cfg);
    case 'compare':
      return compareItem(ctx, cfg);
    case 'convert':
      return convertItem(ctx);
  }
};
