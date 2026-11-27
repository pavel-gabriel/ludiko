/**
 * Biology generators (subject "bio"):
 *   bio-punnett  monohybrid crosses (grade VIII heredity): gametes, % of a genotype or phenotype,
 *                with the Punnett square drawn as a 3x3 grid at the easier levels
 *   bio-magnify  total magnification of a light microscope (ocular x objective), grade V
 */
import type { ChoiceItem, Item, VisualSpec } from '../../types';
import { listParam, numericItem } from './natNum';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, optionCount, pick, shuffle } from './util';

/** [dominant letter, plant/animal sentence start, dominant trait, recessive trait] */
const TRAITS: [string, string, string, string][] = [
  ['G', 'La mazăre', 'semințele galbene', 'semințele verzi'],
  ['R', 'La mazăre', 'semințele netede', 'semințele zbârcite'],
  ['T', 'La mazăre', 'tulpina înaltă', 'tulpina pitică'],
  ['P', 'La mazăre', 'florile violete', 'florile albe'],
  ['B', 'La cobai', 'blana neagră', 'blana albă'],
];
const TRAITS_EN: Record<string, [string, string, string]> = {
  G: ['In peas', 'yellow seeds', 'green seeds'],
  R: ['In peas', 'smooth seeds', 'wrinkled seeds'],
  T: ['In peas', 'a tall stem', 'a short stem'],
  P: ['In peas', 'violet flowers', 'white flowers'],
  B: ['In guinea pigs', 'black fur', 'white fur'],
};

const CROSSES: [string, string][] = [['AA', 'aa'], ['Aa', 'aa'], ['Aa', 'Aa'], ['AA', 'Aa'], ['AA', 'AA'], ['aa', 'aa']];

const withLetter = (g: string, L: string): string => g.replace(/A/g, L.toUpperCase()).replace(/a/g, L.toLowerCase());
/** Uppercase first: "aA" -> "Aa" */
const norm = (g: string): string => (g[0] === g[0].toLowerCase() && g[1] === g[1].toUpperCase() ? g[1] + g[0] : g);

export const bioPunnett: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, listParam(params, 'modes', d <= 1 ? ['gametes', 'phenotype', 'genotype'] : ['gametes', 'phenotype', 'genotype', 'phenotype', 'genotype']));
  const [L, who, dom, rec] = pick(rng, TRAITS);
  const [whoEn, domEn, recEn] = TRAITS_EN[L];
  const [x, y] = shuffle(rng, pick(rng, CROSSES));
  const gx = withLetter(x, L);
  const gy = withLetter(y, L);
  const upper = L.toUpperCase();
  const lower = L.toLowerCase();

  if (mode === 'gametes') {
    const g = rng() < 0.5 ? gx : gy;
    const hetero = g[0] !== g[1];
    const correct = hetero ? `${upper} și ${lower}` : g[0] === upper ? `doar ${upper}` : `doar ${lower}`;
    const options = [`${upper} și ${lower}`, `doar ${upper}`, `doar ${lower}`, `${g}`].slice(0, optionCount(d));
    const texts = shuffle(rng, options.includes(correct) ? options : [correct, ...options.slice(0, -1)]);
    const item: ChoiceItem = {
      ...baseFields(ctx, {
        ro: `Ce tipuri de gameți produce un individ cu genotipul ${g}? (${upper} = alela dominantă, ${lower} = alela recesivă)`,
        en: `Which gametes does an individual with genotype ${g} produce? (${upper} = dominant allele, ${lower} = recessive allele)`,
      }),
      type: 'choice',
      options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: t } })),
      correctId: `o${texts.indexOf(correct)}`,
    };
    return item;
  }

  const gam = (g: string): string[] => (g[0] === g[1] ? [g[0]] : [g[0], g[1]]);
  const cellsOf = (): string[] => {
    const out: string[] = [];
    for (const b of [gy[0], gy[1]]) for (const a of [gx[0], gx[1]]) out.push(norm(a + b));
    return out;
  };
  const offspring = cellsOf();
  void gam;
  const header: (string | null)[] = ['×', gx[0], gx[1], gy[0], null, null, gy[1], null, null];
  const full = [...header];
  full[4] = offspring[0];
  full[5] = offspring[1];
  full[7] = offspring[2];
  full[8] = offspring[3];
  const visual: VisualSpec | undefined = d <= 1 ? { kind: 'grid', rows: 3, cols: 3, cells: full } : d === 2 ? { kind: 'grid', rows: 3, cols: 3, cells: header } : undefined;

  const intro = { ro: `${who}, ${dom} domină ${rec} (${upper} = dominant, ${lower} = recesiv). Se încrucișează doi indivizi cu genotipurile ${gx} × ${gy}.`, en: `${whoEn}, ${domEn} dominates ${recEn} (${upper} = dominant, ${lower} = recessive). Two individuals with genotypes ${gx} × ${gy} are crossed.` };
  if (mode === 'phenotype') {
    const dominant = rng() < 0.5;
    const count = offspring.filter((g) => (dominant ? g.includes(upper) : g === `${lower}${lower}`)).length;
    return numericItem(ctx, {
      ro: `${intro.ro} Ce procent dintre descendenți au fenotipul ${dominant ? 'dominant' : 'recesiv'}?`,
      en: `${intro.en} What percentage of the offspring has the ${dominant ? 'dominant' : 'recessive'} phenotype?`,
    }, count * 25, visual);
  }
  const asked = pick(rng, [`${upper}${upper}`, `${upper}${lower}`, `${lower}${lower}`]);
  return numericItem(ctx, {
    ro: `${intro.ro} Ce procent dintre descendenți au genotipul ${asked}?`,
    en: `${intro.en} What percentage of the offspring has the genotype ${asked}?`,
  }, offspring.filter((g) => g === asked).length * 25, visual);
};

export const bioMagnify: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  const oc = pick(rng, [5, 10, 15]);
  const ob = pick(rng, [4, 10, 40, 100]);
  if (d >= 2 && rng() < 0.4) {
    return numericItem(ctx, {
      ro: `Un microscop mărește de ${oc * ob} de ori în total, iar ocularul este ${oc}×. Cât este mărirea obiectivului (×)?`,
      en: `A microscope magnifies ${oc * ob} times in total and the eyepiece is ${oc}×. What is the magnification of the objective (×)?`,
    }, ob);
  }
  return numericItem(ctx, {
    ro: `Un microscop are ocularul ${oc}× și obiectivul ${ob}×. Cât este mărirea totală?`,
    en: `A microscope has a ${oc}× eyepiece and a ${ob}× objective. What is the total magnification?`,
  }, oc * ob);
};

registerGenerator('bio-punnett', bioPunnett);
registerGenerator('bio-magnify', bioMagnify);
