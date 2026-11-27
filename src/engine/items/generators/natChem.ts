/**
 * Chemistry generators (subject "chim", grades VII-VIII), all deterministic with exact answers:
 *
 *   chim-atom      protons / neutrons / electrons / mass number              params: { modes? }
 *   chim-config    electron shells, outer electrons, period (Z = 1..20)       params: { modes? }
 *   chim-formula   count the atoms in a chemical formula
 *   chim-molmass   molar mass from the atomic masses given in the prompt
 *   chim-valence   formula from valences / valence from a formula              params: { modes? }
 *   chim-balance   the missing coefficient of a balanced equation (fill-gap)   params: { level? }
 *   chim-solution  concentration, dissolved mass, solution mass, water mass
 *   chim-masslaw   conservation of mass for complete reactions
 *   chim-ph        acid / neutral / basic from the pH
 * The elements, formulas and equations below are chemical facts (not creative expression), written by us.
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, SortItem } from '../../types';
import { disp, listParam, numericItem } from './natNum';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, optionCount, pick, randInt, shuffle } from './util';

/* ---- elements -------------------------------------------------------- */

/** [symbol, Romanian name, English name, mass number A of the common isotope] for Z = 1..20 */
const ELEMENTS: [string, string, string, number][] = [
  ['H', 'hidrogen', 'hydrogen', 1],
  ['He', 'heliu', 'helium', 4],
  ['Li', 'litiu', 'lithium', 7],
  ['Be', 'beriliu', 'beryllium', 9],
  ['B', 'bor', 'boron', 11],
  ['C', 'carbon', 'carbon', 12],
  ['N', 'azot', 'nitrogen', 14],
  ['O', 'oxigen', 'oxygen', 16],
  ['F', 'fluor', 'fluorine', 19],
  ['Ne', 'neon', 'neon', 20],
  ['Na', 'sodiu', 'sodium', 23],
  ['Mg', 'magneziu', 'magnesium', 24],
  ['Al', 'aluminiu', 'aluminium', 27],
  ['Si', 'siliciu', 'silicon', 28],
  ['P', 'fosfor', 'phosphorus', 31],
  ['S', 'sulf', 'sulfur', 32],
  ['Cl', 'clor', 'chlorine', 35],
  ['Ar', 'argon', 'argon', 40],
  ['K', 'potasiu', 'potassium', 39],
  ['Ca', 'calciu', 'calcium', 40],
];

/** Electrons per shell (K, L, M, N) for an atom of atomic number z <= 20 */
export function shells(z: number): number[] {
  const cap = [2, 8, 8, 18];
  const out: number[] = [];
  let left = z;
  for (const c of cap) {
    if (left <= 0) break;
    out.push(Math.min(c, left));
    left -= c;
  }
  return out;
}

export const chimAtom: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const mode = pick(rng, listParam(params, 'modes', ['neutrons', 'electrons', 'mass', 'atomic']));
  const z = randInt(rng, 1, 20);
  const [sym, ro, en, a] = ELEMENTS[z - 1];
  if (mode === 'neutrons') {
    return numericItem(ctx, {
      ro: `Atomul de ${ro} (${sym}) are Z = ${z} și A = ${a}. Câți neutroni are?`,
      en: `The ${en} (${sym}) atom has Z = ${z} and A = ${a}. How many neutrons does it have?`,
    }, a - z);
  }
  if (mode === 'electrons') {
    return numericItem(ctx, {
      ro: `Atomul neutru de ${ro} (${sym}) are Z = ${z}. Câți electroni are?`,
      en: `The neutral ${en} (${sym}) atom has Z = ${z}. How many electrons does it have?`,
    }, z);
  }
  if (mode === 'mass') {
    return numericItem(ctx, {
      ro: `Un atom are ${z} protoni și ${a - z} neutroni. Care este numărul lui de masă A?`,
      en: `An atom has ${z} protons and ${a - z} neutrons. What is its mass number A?`,
    }, a);
  }
  return numericItem(ctx, {
    ro: `Un atom are A = ${a} și ${a - z} neutroni. Care este numărul lui atomic Z?`,
    en: `An atom has A = ${a} and ${a - z} neutrons. What is its atomic number Z?`,
  }, z);
};

export const chimConfig: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, listParam(params, 'modes', ['outer', 'period', 'config']));
  const z = randInt(rng, 3, 20);
  const [sym, ro, en] = ELEMENTS[z - 1];
  const sh = shells(z);
  if (mode === 'outer') {
    return numericItem(ctx, {
      ro: `Elementul ${ro} (${sym}) are Z = ${z}. Câți electroni are pe ultimul strat?`,
      en: `The element ${en} (${sym}) has Z = ${z}. How many electrons are on its outermost shell?`,
    }, sh[sh.length - 1]);
  }
  if (mode === 'period') {
    return numericItem(ctx, {
      ro: `Elementul ${ro} (${sym}) are Z = ${z}. În ce perioadă a sistemului periodic se află?`,
      en: `The element ${en} (${sym}) has Z = ${z}. In which period of the periodic table is it?`,
    }, sh.length);
  }
  const text = (s: number[]) => s.join(', ');
  const wrong = new Set<string>();
  const cands = [
    [...sh.slice(0, -1), sh[sh.length - 1] + 1],
    [...sh.slice(0, -1), Math.max(1, sh[sh.length - 1] - 1)],
    [...sh].reverse(),
    [z],
    sh.length > 1 ? [sh[0], sh.slice(1).reduce((x, y) => x + y, 0)] : [1, z - 1],
    [2, ...(z > 2 ? [Math.min(z - 2, 18)] : [])],
  ].map(text);
  for (const c of cands) if (c !== text(sh)) wrong.add(c);
  const texts = shuffle(rng, [text(sh), ...shuffle(rng, [...wrong]).slice(0, optionCount(d) - 1)]);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `Cum sunt distribuiți electronii pe straturi (K, L, M, ...) la atomul de ${ro} (${sym}), Z = ${z}?`,
      en: `How are the electrons spread over the shells (K, L, M, ...) in the ${en} (${sym}) atom, Z = ${z}?`,
    }),
    type: 'choice',
    options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: t } })),
    correctId: `o${texts.indexOf(text(sh))}`,
  };
  return item;
};

/* ---- formulas -------------------------------------------------------- */

const FORMULAS = [
  'H2O', 'CO2', 'NaOH', 'CaCO3', 'H2SO4', 'HNO3', 'NH3', 'CH4', 'MgO', 'Fe2O3', 'Al2O3', 'CaO', 'NaCl', 'HCl', 'KOH',
  'Ca(OH)2', 'CuSO4', 'Na2CO3', 'C6H12O6', 'H2O2', 'SO2', 'SO3', 'Mg(OH)2', 'Al(OH)3', 'AgNO3', 'H3PO4', 'ZnO', 'CuO',
];

const AR: Record<string, number> = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, P: 31, S: 32, Cl: 35.5, K: 39, Ca: 40, Fe: 56, Cu: 64, Zn: 65, Ag: 108 };

/** element -> atom count of a formula such as Ca(OH)2 or Al2(SO4)3 (one level of brackets) */
export function countAtoms(formula: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (el: string, n: number) => out.set(el, (out.get(el) ?? 0) + n);
  const re = /\(([A-Za-z0-9]+)\)(\d*)|([A-Z][a-z]?)(\d*)/g;
  for (const m of formula.matchAll(re)) {
    if (m[1] !== undefined) {
      const mult = m[2] ? Number(m[2]) : 1;
      for (const inner of m[1].matchAll(/([A-Z][a-z]?)(\d*)/g)) add(inner[1], (inner[2] ? Number(inner[2]) : 1) * mult);
    } else add(m[3], m[4] ? Number(m[4]) : 1);
  }
  return out;
}

export const chimFormula: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  const f = pick(rng, FORMULAS.filter((x) => d >= 2 || !x.includes('(')));
  const atoms = countAtoms(f);
  if (rng() < 0.5 || atoms.size === 1) {
    const total = [...atoms.values()].reduce((s, x) => s + x, 0);
    return numericItem(ctx, {
      ro: `Câți atomi are în total formula chimică ${f}?`,
      en: `How many atoms are there in total in the chemical formula ${f}?`,
    }, total);
  }
  const el = pick(rng, [...atoms.keys()]);
  return numericItem(ctx, {
    ro: `Câți atomi de ${el} sunt în formula chimică ${f}?`,
    en: `How many ${el} atoms are there in the chemical formula ${f}?`,
  }, atoms.get(el) as number);
};

export const chimMolmass: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  const f = pick(rng, FORMULAS.filter((x) => (d >= 2 || !x.includes('(')) && (d >= 2 || x.length <= 5)));
  const atoms = countAtoms(f);
  const mass = [...atoms].reduce((s, [el, n]) => s + AR[el] * n, 0);
  const list = [...atoms.keys()].map((el) => `${el} = ${disp(AR[el])}`).join(', ');
  return numericItem(ctx, {
    ro: `Calculează masa molară a substanței ${f} (în g/mol). Mase atomice: ${list}.`,
    en: `Find the molar mass of ${f} (in g/mol). Atomic masses: ${list}.`,
  }, mass);
};

/* ---- valence --------------------------------------------------------- */

/** [A, valence of A, B, valence of B] — binary compounds with a unique, textbook-standard valence pair */
const BINARY: [string, number, string, number][] = [
  ['H', 1, 'Cl', 1], ['H', 1, 'O', 2], ['H', 1, 'S', 2], ['H', 1, 'N', 3], ['H', 1, 'C', 4], ['Na', 1, 'Cl', 1], ['Na', 1, 'O', 2],
  ['K', 1, 'O', 2], ['Mg', 2, 'O', 2], ['Mg', 2, 'Cl', 1], ['Ca', 2, 'O', 2], ['Ca', 2, 'Cl', 1], ['Al', 3, 'O', 2], ['Al', 3, 'Cl', 1],
  ['Fe', 3, 'O', 2], ['Fe', 2, 'O', 2], ['Fe', 3, 'Cl', 1], ['Zn', 2, 'O', 2], ['Cu', 2, 'O', 2], ['Cu', 1, 'O', 2], ['C', 4, 'O', 2],
  ['S', 4, 'O', 2], ['S', 6, 'O', 2], ['N', 5, 'O', 2], ['P', 5, 'O', 2], ['Si', 4, 'O', 2], ['Ag', 1, 'Cl', 1], ['Al', 3, 'S', 2],
  ['Ca', 2, 'N', 3], ['Mg', 2, 'N', 3], ['Na', 1, 'S', 2],
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Criss-cross rule with simplification */
export function binaryFormula(a: string, va: number, b: string, vb: number): string {
  const g = gcd(va, vb);
  const na = vb / g;
  const nb = va / g;
  return `${a}${na > 1 ? na : ''}${b}${nb > 1 ? nb : ''}`;
}

export const chimValence: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, listParam(params, 'modes', ['formula', 'valence']));
  const [a, va, b, vb] = pick(rng, BINARY);
  const formula = binaryFormula(a, va, b, vb);
  if (mode === 'valence') {
    const unknownIsA = rng() < 0.7 || b === 'O';
    if (unknownIsA) {
      return numericItem(ctx, {
        ro: `În compusul ${formula}, ${b} are valența ${ROMAN[vb]}. Care este valența lui ${a}? (scrie numărul)`,
        en: `In the compound ${formula}, ${b} has valence ${ROMAN[vb]}. What is the valence of ${a}? (write the number)`,
      }, va);
    }
  }
  const correct = formula;
  const cands = new Set<string>();
  for (let x = 1; x <= 5; x++) {
    for (let y = 1; y <= 5; y++) cands.add(`${a}${x > 1 ? x : ''}${b}${y > 1 ? y : ''}`);
  }
  cands.delete(correct);
  // the most tempting wrong answers first: swapped indices and the unsimplified criss-cross
  const swapped = `${a}${va > 1 ? va : ''}${b}${vb > 1 ? vb : ''}`;
  const tempting = [swapped, binaryFormula(b, vb, a, va)].filter((x) => x !== correct && cands.has(x));
  const rest = shuffle(rng, [...cands].filter((x) => !tempting.includes(x)));
  const wrong = [...shuffle(rng, tempting), ...rest].slice(0, optionCount(d) - 1);
  const texts = shuffle(rng, [correct, ...wrong]);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `Care este formula compusului dintre ${a} (valența ${ROMAN[va]}) și ${b} (valența ${ROMAN[vb]})?`,
      en: `Which is the formula of the compound of ${a} (valence ${ROMAN[va]}) and ${b} (valence ${ROMAN[vb]})?`,
    }),
    type: 'choice',
    options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: t } })),
    correctId: `o${texts.indexOf(correct)}`,
  };
  return item;
};

/* ---- equations ------------------------------------------------------- */

/** Balanced equations: [reactants[], products[]] as [coefficient, formula]; level 1 = easy */
const EQUATIONS: { level: number; l: [number, string][]; r: [number, string][] }[] = [
  { level: 1, l: [[2, 'H2'], [1, 'O2']], r: [[2, 'H2O']] },
  { level: 1, l: [[2, 'Mg'], [1, 'O2']], r: [[2, 'MgO']] },
  { level: 1, l: [[2, 'Na'], [1, 'Cl2']], r: [[2, 'NaCl']] },
  { level: 1, l: [[2, 'Cu'], [1, 'O2']], r: [[2, 'CuO']] },
  { level: 1, l: [[1, 'CaCO3']], r: [[1, 'CaO'], [1, 'CO2']] },
  { level: 1, l: [[1, 'CuO'], [1, 'H2']], r: [[1, 'Cu'], [1, 'H2O']] },
  { level: 1, l: [[1, 'NaOH'], [1, 'HCl']], r: [[1, 'NaCl'], [1, 'H2O']] },
  { level: 1, l: [[1, 'Zn'], [2, 'HCl']], r: [[1, 'ZnCl2'], [1, 'H2']] },
  { level: 1, l: [[1, 'Mg'], [2, 'HCl']], r: [[1, 'MgCl2'], [1, 'H2']] },
  { level: 1, l: [[2, 'HgO']], r: [[2, 'Hg'], [1, 'O2']] },
  { level: 2, l: [[1, 'N2'], [3, 'H2']], r: [[2, 'NH3']] },
  { level: 2, l: [[1, 'CH4'], [2, 'O2']], r: [[1, 'CO2'], [2, 'H2O']] },
  { level: 2, l: [[2, 'H2O2']], r: [[2, 'H2O'], [1, 'O2']] },
  { level: 2, l: [[2, 'Na'], [2, 'H2O']], r: [[2, 'NaOH'], [1, 'H2']] },
  { level: 2, l: [[1, 'Ca'], [2, 'H2O']], r: [[1, 'Ca(OH)2'], [1, 'H2']] },
  { level: 2, l: [[2, 'NaOH'], [1, 'H2SO4']], r: [[1, 'Na2SO4'], [2, 'H2O']] },
  { level: 2, l: [[1, 'Ca(OH)2'], [2, 'HCl']], r: [[1, 'CaCl2'], [2, 'H2O']] },
  { level: 2, l: [[2, 'Fe'], [3, 'Cl2']], r: [[2, 'FeCl3']] },
  { level: 3, l: [[4, 'Al'], [3, 'O2']], r: [[2, 'Al2O3']] },
  { level: 3, l: [[4, 'Fe'], [3, 'O2']], r: [[2, 'Fe2O3']] },
  { level: 3, l: [[2, 'Al'], [6, 'HCl']], r: [[2, 'AlCl3'], [3, 'H2']] },
  { level: 3, l: [[1, 'Fe2O3'], [3, 'CO']], r: [[2, 'Fe'], [3, 'CO2']] },
  { level: 3, l: [[2, 'KClO3']], r: [[2, 'KCl'], [3, 'O2']] },
  { level: 3, l: [[1, 'C3H8'], [5, 'O2']], r: [[3, 'CO2'], [4, 'H2O']] },
  { level: 3, l: [[2, 'H2S'], [3, 'O2']], r: [[2, 'SO2'], [2, 'H2O']] },
  { level: 3, l: [[2, 'Al(OH)3']], r: [[1, 'Al2O3'], [3, 'H2O']] },
];

export const chimBalance: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const maxLevel = typeof params.level === 'number' ? params.level : d <= 1 ? 1 : d === 2 ? 2 : 3;
  const eq = pick(rng, EQUATIONS.filter((e) => e.level <= maxLevel));
  const species = [...eq.l.map((s) => ({ s, side: 'l' })), ...eq.r.map((s) => ({ s, side: 'r' }))];
  const chosen = pick(rng, species);
  const fmt = (side: [number, string][]): string =>
    side.map((s) => (s === chosen.s ? `{{gap}} ${s[1]}` : s[0] === 1 ? s[1] : `${s[0]} ${s[1]}`)).join(' + ');
  const template = `${fmt(eq.l)} → ${fmt(eq.r)}`;
  const correct = String(chosen.s[0]);
  const pool = ['1', '2', '3', '4', '5', '6'].filter((x) => x !== correct);
  const options = [...shuffle(rng, pool).slice(0, 3), correct].sort();
  const item: FillGapItem = {
    ...baseFields(ctx, {
      ro: 'Completează coeficientul care lipsește, astfel încât ecuația reacției să fie echilibrată (fără coeficient înseamnă 1).',
      en: 'Fill in the missing coefficient so that the reaction equation is balanced (no coefficient means 1).',
    }),
    type: 'fill-gap',
    template: { ro: template, en: template },
    options,
    correct,
  };
  return item;
};

/* ---- solutions, mass law, pH ----------------------------------------- */

export const chimSolution: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, listParam(params, 'modes', d <= 1 ? ['c'] : ['c', 'md', 'ms', 'water']));
  const ms = pick(rng, [100, 200, 400, 500]);
  const c = pick(rng, [2, 5, 10, 20, 25]);
  const md = (c * ms) / 100;
  if (mode === 'md') {
    return numericItem(ctx, {
      ro: `O soluție are masa ms = ${ms} g și concentrația c = ${c} %. Calculează masa de substanță dizolvată md (în g).`,
      en: `A solution has mass ms = ${ms} g and concentration c = ${c} %. Find the dissolved mass md (in g).`,
    }, md);
  }
  if (mode === 'ms') {
    return numericItem(ctx, {
      ro: `O soluție de concentrație c = ${c} % conține md = ${md} g de substanță dizolvată. Calculează masa soluției ms (în g).`,
      en: `A solution of concentration c = ${c} % contains md = ${md} g of dissolved substance. Find the solution mass ms (in g).`,
    }, ms);
  }
  if (mode === 'water') {
    return numericItem(ctx, {
      ro: `O soluție are masa ms = ${ms} g și conține md = ${md} g de substanță dizolvată. Calculează masa de apă (în g).`,
      en: `A solution has mass ms = ${ms} g and contains md = ${md} g of dissolved substance. Find the mass of water (in g).`,
    }, ms - md);
  }
  return numericItem(ctx, {
    ro: `O soluție are masa ms = ${ms} g și conține md = ${md} g de substanță dizolvată. Calculează concentrația procentuală c (în %).`,
    en: `A solution has mass ms = ${ms} g and contains md = ${md} g of dissolved substance. Find the concentration c (in %).`,
  }, c);
}

/** [equation text, mass of reactant 1 : mass of reactant 2 for one "unit"] — coefficients as in the equation */
const MASS_REACTIONS: { eq: string; a: string; b: string; p: string; ra: number; rb: number }[] = [
  { eq: '2 Mg + O2 → 2 MgO', a: 'Mg', b: 'O2', p: 'MgO', ra: 3, rb: 2 },
  { eq: 'Fe + S → FeS', a: 'Fe', b: 'S', p: 'FeS', ra: 7, rb: 4 },
  { eq: 'C + O2 → CO2', a: 'C', b: 'O2', p: 'CO2', ra: 3, rb: 8 },
  { eq: '2 H2 + O2 → 2 H2O', a: 'H2', b: 'O2', p: 'H2O', ra: 1, rb: 8 },
  { eq: '2 Cu + O2 → 2 CuO', a: 'Cu', b: 'O2', p: 'CuO', ra: 4, rb: 1 },
  { eq: '2 Ca + O2 → 2 CaO', a: 'Ca', b: 'O2', p: 'CaO', ra: 5, rb: 2 },
  { eq: 'S + O2 → SO2', a: 'S', b: 'O2', p: 'SO2', ra: 1, rb: 1 },
];

export const chimMasslaw: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  const r = pick(rng, MASS_REACTIONS);
  const k = randInt(rng, 1, d <= 1 ? 4 : 10);
  const ma = r.ra * k;
  const mb = r.rb * k;
  if (d >= 2 && rng() < 0.5) {
    return numericItem(ctx, {
      ro: `În reacția ${r.eq} (reactanții se consumă complet) se folosesc ${ma} g de ${r.a} și se obțin ${ma + mb} g de ${r.p}. Câte grame de ${r.b} au reacționat?`,
      en: `In the reaction ${r.eq} (the reactants are used up completely) ${ma} g of ${r.a} are used and ${ma + mb} g of ${r.p} are obtained. How many grams of ${r.b} reacted?`,
    }, mb);
  }
  return numericItem(ctx, {
    ro: `În reacția ${r.eq} (reactanții se consumă complet) reacționează ${ma} g de ${r.a} cu ${mb} g de ${r.b}. Câte grame de ${r.p} se obțin?`,
    en: `In the reaction ${r.eq} (the reactants are used up completely) ${ma} g of ${r.a} react with ${mb} g of ${r.b}. How many grams of ${r.p} are obtained?`,
  }, ma + mb);
};

const PH_LABELS: Record<string, { ro: string; en: string }> = {
  acid: { ro: 'acidă', en: 'acidic' },
  neutral: { ro: 'neutră', en: 'neutral' },
  base: { ro: 'bazică', en: 'basic' },
};
const phClass = (ph: number): string => (ph < 7 ? 'acid' : ph === 7 ? 'neutral' : 'base');

export const chimPh: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  if (rng() < 0.5) {
    const ph = randInt(rng, 1, 14);
    const cls = phClass(ph);
    const opts = ['acid', 'neutral', 'base'];
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: `O soluție are pH = ${ph}. Ea este:`, en: `A solution has pH = ${ph}. It is:` }),
      type: 'choice',
      options: opts.map((o) => ({ id: o, text: { ro: PH_LABELS[o].ro, en: PH_LABELS[o].en } })),
      correctId: cls,
    };
    return item;
  }
  const take = (from: number[], n: number) => shuffle(rng, from).slice(0, n);
  const per = d <= 1 ? 1 : 2;
  const values = [...take([1, 2, 3, 4, 5, 6], per), ...(d >= 2 ? [7] : take([7], 1)), ...take([8, 9, 10, 11, 12, 13, 14], per)];
  const cards: (CardContent & { categoryId: string })[] = shuffle(rng, values).map((ph) => ({ id: `ph${ph}`, text: { ro: `pH = ${ph}` }, categoryId: phClass(ph) }));
  const item: SortItem = {
    ...baseFields(ctx, { ro: 'Pune fiecare soluție în grupa potrivită, după pH.', en: 'Put each solution in the right group, by its pH.' }),
    type: 'sort',
    categories: ['acid', 'neutral', 'base'].map((c) => ({ id: c, label: PH_LABELS[c] })),
    cards,
  };
  return item;
};

registerGenerator('chim-atom', chimAtom);
registerGenerator('chim-config', chimConfig);
registerGenerator('chim-formula', chimFormula);
registerGenerator('chim-molmass', chimMolmass);
registerGenerator('chim-valence', chimValence);
registerGenerator('chim-balance', chimBalance);
registerGenerator('chim-solution', chimSolution);
registerGenerator('chim-masslaw', chimMasslaw);
registerGenerator('chim-ph', chimPh);
