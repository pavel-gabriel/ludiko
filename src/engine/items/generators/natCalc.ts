/**
 * Physics calculation generators (subject "fiz"), deterministic and with integer-exact answers:
 *
 *   fiz-convert  unit conversion inside one quantity family        params: { family }
 *                length, mass, area, volume, pressure, force, energy, power, current, voltage, resistance,
 *                time, speed ("km/h" <-> "m/s")
 *   fiz-calc     one-formula problems ("Calculează viteza v ...")  params: { kind }
 *                speed, density, pressure, power, current, weight, hooke, work, ohm, elpower, hydro,
 *                archimedes, potential, heat, kinetic, avgspeed
 *   fiz-lever    lever in equilibrium F1·d1 = F2·d2
 *   fiz-resistors equivalent resistance, series and parallel
 *   fiz-read     read a ruler / a thermometer, areas and volumes of boxes   params: { kind }
 *
 * `kind`/`family` may also be a list: one is drawn per item.
 */
import type { Item, VisualSpec } from '../../types';
import { disp, listParam, numericItem } from './natNum';
import { registerGenerator, type GeneratorFn } from './registry';
import { pick, randInt, shuffle } from './util';

/* ------------------------------------------------------------------ */
/*  Unit conversion                                                    */
/* ------------------------------------------------------------------ */

/** unit -> power of ten of "how many of this unit make the family base unit" (higher = smaller unit) */
const FAMILIES: Record<string, Record<string, number>> = {
  length: { km: -3, m: 0, dm: 1, cm: 2, mm: 3 },
  mass: { t: -3, kg: 0, g: 3, mg: 6 },
  area: { 'm²': 0, 'dm²': 2, 'cm²': 4, 'mm²': 6 },
  volume: { 'm³': 0, 'dm³': 3, l: 3, 'cm³': 6, ml: 6 },
  pressure: { kPa: -3, hPa: -2, Pa: 0 },
  force: { kN: -3, N: 0 },
  energy: { kJ: -3, J: 0 },
  power: { MW: -6, kW: -3, W: 0 },
  current: { A: 0, mA: 3 },
  voltage: { kV: -3, V: 0, mV: 3 },
  resistance: { kΩ: -3, Ω: 0 },
};

const TIME_STEPS: [string, string, number][] = [
  ['h', 'min', 60],
  ['min', 's', 60],
  ['h', 's', 3600],
];

export const fizConvert: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const family = pick(rng, listParam(params, 'family', ['length']));

  if (family === 'time') {
    if (d >= 2 && rng() < 0.3) {
      const h = randInt(rng, 1, 5);
      const min = randInt(rng, 1, 11) * 5;
      return numericItem(ctx, { ro: `${h} h ${min} min = ? min`, en: `${h} h ${min} min = ? min` }, h * 60 + min);
    }
    const [big, small, f] = pick(rng, TIME_STEPS);
    if (rng() < 0.5) {
      const n = randInt(rng, 1, 12);
      return numericItem(ctx, { ro: `${n} ${big} = ? ${small}` }, n * f);
    }
    const n = randInt(rng, 1, 12);
    return numericItem(ctx, { ro: `${n * f} ${small} = ? ${big}` }, n);
  }
  if (family === 'speed') {
    const n = randInt(rng, 1, 8);
    if (rng() < 0.5) return numericItem(ctx, { ro: `${n * 36} km/h = ? m/s`, en: `${n * 36} km/h = ? m/s` }, n * 10);
    return numericItem(ctx, { ro: `${n * 5} m/s = ? km/h`, en: `${n * 5} m/s = ? km/h` }, n * 18);
  }
  const fam = FAMILIES[family];
  if (!fam) throw new Error(`fiz-convert: unknown family "${family}" (skill ${ctx.skill.id})`);
  const units = Object.keys(fam);
  const maxStep = d <= 1 ? 3 : 6;
  for (let tries = 0; tries < 100; tries++) {
    const [from, to] = shuffle(rng, units).slice(0, 2);
    const e = fam[to] - fam[from]; // value in `from` times 10^e is the value in `to`
    if (Math.abs(e) > maxStep) continue;
    if (e === 0 && rng() < 0.6) continue;
    const n = randInt(rng, 1, 99);
    let value: number;
    let result: number;
    if (e >= 0) {
      value = n;
      result = n * 10 ** e;
    } else {
      const decimal = d >= 3 && rng() < 0.4 && n % 10 !== 0;
      value = decimal ? n * 10 ** (-e - 1) : n * 10 ** -e;
      result = decimal ? n / 10 : n;
    }
    if (value > 9_999_999) continue;
    return numericItem(ctx, { ro: `${disp(value)} ${from} = ? ${to}`, en: `${disp(value)} ${from} = ? ${to}` }, result);
  }
  return numericItem(ctx, { ro: '3 m = ? cm', en: '3 m = ? cm' }, 300);
};

/* ------------------------------------------------------------------ */
/*  One-formula problems                                               */
/* ------------------------------------------------------------------ */

interface V {
  sym: string;
  ro: string;
  en: string;
  unit: string;
}
interface Constant {
  sym: string;
  value: number;
  unit: string;
}
/** result = a·b·∏consts (mul) or a / b (div); `b` may be missing in mul */
interface Case {
  formula: string;
  op: 'mul' | 'div';
  r: V;
  a: V;
  b?: V;
  consts?: Constant[];
  av: number;
  bv?: number;
  rv: number;
}

const stepped = (rng: () => number, lo: number, hi: number, step = 1): number => lo + randInt(rng, 0, Math.floor((hi - lo) / step)) * step;
const G: Constant = { sym: 'g', value: 10, unit: 'N/kg' };

function divCase(rng: () => number, formula: string, r: V, a: V, b: V, rLo: number, rHi: number, rStep: number, bLo: number, bHi: number, bStep = 1): Case {
  const rv = stepped(rng, rLo, rHi, rStep);
  const bv = stepped(rng, bLo, bHi, bStep);
  return { formula, op: 'div', r, a, b, av: rv * bv, bv, rv };
}

function mulCase(rng: () => number, formula: string, r: V, a: V, b: V | undefined, aR: [number, number, number?], bR: [number, number, number?] | undefined, consts: Constant[] = []): Case {
  const av = stepped(rng, aR[0], aR[1], aR[2] ?? 1);
  const bv = b && bR ? stepped(rng, bR[0], bR[1], bR[2] ?? 1) : undefined;
  const k = consts.reduce((p, c) => p * c.value, 1);
  return { formula, op: 'mul', r, a, b, consts, av, bv, rv: Number((av * (bv ?? 1) * k).toFixed(6)) };
}

const v = (sym: string, ro: string, en: string, unit: string): V => ({ sym, ro, en, unit });

const KINDS: Record<string, (rng: () => number, d: number) => Case> = {
  speed: (rng, d) => {
    const r = v('v', 'viteza', 'the speed', 'm/s');
    return rng() < 0.6 || d <= 1
      ? divCase(rng, 'v = d / t', r, v('d', 'distanța', 'the distance', 'm'), v('t', 'timpul', 'the time', 's'), 2, 30, 1, 2, 20)
      : divCase(rng, 'v = d / t', { ...r, unit: 'km/h' }, v('d', 'distanța', 'the distance', 'km'), v('t', 'timpul', 'the time', 'h'), 10, 100, 5, 2, 8);
  },
  density: (rng, d) =>
    d >= 3 && rng() < 0.35
      ? (() => {
          const rho = pick(rng, [800, 1000, 2700, 7800]);
          const V = randInt(rng, 1, 8);
          return { formula: 'ρ = m / V', op: 'div' as const, r: v('ρ', 'densitatea', 'the density', 'kg/m³'), a: v('m', 'masa', 'the mass', 'kg'), b: v('V', 'volumul', 'the volume', 'm³'), av: rho * V, bv: V, rv: rho };
        })()
      : divCase(rng, 'ρ = m / V', v('ρ', 'densitatea', 'the density', 'g/cm³'), v('m', 'masa', 'the mass', 'g'), v('V', 'volumul', 'the volume', 'cm³'), 1, 11, 1, 5, 50, 5),
  pressure: (rng) => divCase(rng, 'p = F / S', v('p', 'presiunea', 'the pressure', 'Pa'), v('F', 'forța', 'the force', 'N'), v('S', 'suprafața', 'the area', 'm²'), 100, 2000, 100, 1, 8),
  power: (rng) => divCase(rng, 'P = L / t', v('P', 'puterea', 'the power', 'W'), v('L', 'lucrul mecanic', 'the work', 'J'), v('t', 'timpul', 'the time', 's'), 10, 500, 10, 2, 30),
  current: (rng) => divCase(rng, 'I = Q / t', v('I', 'intensitatea curentului', 'the current', 'A'), v('Q', 'sarcina electrică', 'the charge', 'C'), v('t', 'timpul', 'the time', 's'), 1, 10, 1, 2, 30),
  weight: (rng) => mulCase(rng, 'G = m · g', v('G', 'greutatea', 'the weight', 'N'), v('m', 'masa', 'the mass', 'kg'), undefined, [1, 90], undefined, [G]),
  hooke: (rng) => mulCase(rng, 'F = k · Δl', v('F', 'forța elastică', 'the elastic force', 'N'), v('k', 'constanta elastică', 'the spring constant', 'N/cm'), v('Δl', 'alungirea', 'the elongation', 'cm'), [2, 20], [1, 10]),
  work: (rng) => mulCase(rng, 'L = F · d', v('L', 'lucrul mecanic', 'the work', 'J'), v('F', 'forța', 'the force', 'N'), v('d', 'distanța', 'the distance', 'm'), [5, 200, 5], [1, 20]),
  ohm: (rng) => mulCase(rng, 'U = I · R', v('U', 'tensiunea', 'the voltage', 'V'), v('I', 'intensitatea curentului', 'the current', 'A'), v('R', 'rezistența', 'the resistance', 'Ω'), [1, 6], [2, 50]),
  elpower: (rng) => mulCase(rng, 'P = U · I', v('P', 'puterea electrică', 'the electric power', 'W'), v('U', 'tensiunea', 'the voltage', 'V'), v('I', 'intensitatea curentului', 'the current', 'A'), [6, 24, 6], [1, 10]),
  hydro: (rng) => {
    const rho = pick(rng, [1000, 900, 800]);
    return mulCase(rng, 'p = ρ · g · h', v('p', 'presiunea hidrostatică', 'the hydrostatic pressure', 'Pa'), v('h', 'adâncimea', 'the depth', 'm'), undefined, [1, 12], undefined, [{ sym: 'ρ', value: rho, unit: 'kg/m³' }, G]);
  },
  archimedes: (rng) => {
    const rho = pick(rng, [1, 0.8]);
    return mulCase(rng, 'FA = ρ · g · V', v('FA', 'forța arhimedică', 'the buoyant force', 'N'), v('V', 'volumul scufundat', 'the submerged volume', 'dm³'), undefined, [1, 20], undefined, [{ sym: 'ρ', value: rho, unit: 'kg/dm³' }, G]);
  },
  potential: (rng) => mulCase(rng, 'Ep = m · g · h', v('Ep', 'energia potențială', 'the potential energy', 'J'), v('m', 'masa', 'the mass', 'kg'), v('h', 'înălțimea', 'the height', 'm'), [1, 20], [1, 15], [G]),
  heat: (rng) => {
    const c = pick(rng, [4200, 900, 450]);
    return mulCase(rng, 'Q = m · c · Δt', v('Q', 'căldura', 'the heat', 'J'), v('m', 'masa', 'the mass', 'kg'), v('Δt', 'variația temperaturii', 'the temperature change', 'K'), [1, 5], [5, 40, 5], [{ sym: 'c', value: c, unit: 'J/(kg·K)' }]);
  },
};

const cstr = (c: Constant): string => `${c.sym} = ${disp(c.value)} ${c.unit}`;

function buildCalc(c: Case, rng: () => number, d: number): { ro: string; en: string; answer: number } {
  const asks: ('r' | 'a' | 'b')[] = d <= 1 ? ['r'] : c.b ? ['r', 'r', 'a', 'b'] : ['r', 'a'];
  const ask = pick(rng, asks);
  const entries: [V, number][] = [[c.a, c.av]];
  if (c.b && c.bv !== undefined) entries.push([c.b, c.bv]);
  entries.push([c.r, c.rv]);
  const key = ask === 'r' ? c.r : ask === 'a' ? c.a : (c.b as V);
  const answer = ask === 'r' ? c.rv : ask === 'a' ? c.av : (c.bv as number);
  const givens = entries.filter(([x]) => x !== key).map(([x, val]) => `${x.sym} = ${disp(val)} ${x.unit}`);
  const consts = (c.consts ?? []).map(cstr);
  const all = [...givens, ...consts];
  const join = (and: string) => (all.length > 1 ? `${all.slice(0, -1).join(', ')} ${and} ${all[all.length - 1]}` : all[0]);
  const hint = d < 3 ? { ro: ` Formula: ${c.formula}.`, en: ` Formula: ${c.formula}.` } : { ro: '', en: '' };
  return {
    ro: `Calculează ${key.ro} ${key.sym} (în ${key.unit}), știind că ${join('și')}.${hint.ro}`,
    en: `Find ${key.en} ${key.sym} (in ${key.unit}), given that ${join('and')}.${hint.en}`,
    answer,
  };
}

export const fizCalc: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kind = pick(rng, listParam(params, 'kind', ['speed']));
  if (kind === 'kinetic') {
    const m = randInt(rng, 1, 10) * 2;
    const vel = randInt(rng, 2, 12);
    const hint = d < 3 ? ' Formula: Ec = m · v² / 2.' : '';
    return numericItem(
      ctx,
      {
        ro: `Calculează energia cinetică Ec (în J), știind că m = ${m} kg și v = ${vel} m/s.${hint}`,
        en: `Find the kinetic energy Ec (in J), given that m = ${m} kg and v = ${vel} m/s.${hint}`,
      },
      (m * vel * vel) / 2,
    );
  }
  if (kind === 'avgspeed') {
    const t1 = randInt(rng, 1, 4);
    const t2 = randInt(rng, 1, 4);
    const vm = randInt(rng, 4, 20) * 5;
    const d1 = vm * t1 + randInt(rng, -2, 2) * t1;
    const d2 = vm * (t1 + t2) - d1;
    const hint = d < 3 ? ' Formula: vm = (d1 + d2) / (t1 + t2).' : '';
    return numericItem(
      ctx,
      {
        ro: `Calculează viteza medie vm (în km/h), știind că d1 = ${d1} km, t1 = ${t1} h, d2 = ${d2} km și t2 = ${t2} h.${hint}`,
        en: `Find the average speed vm (in km/h), given that d1 = ${d1} km, t1 = ${t1} h, d2 = ${d2} km and t2 = ${t2} h.${hint}`,
      },
      vm,
    );
  }
  const make = KINDS[kind];
  if (!make) throw new Error(`fiz-calc: unknown kind "${kind}" (skill ${ctx.skill.id})`);
  const built = buildCalc(make(rng, d), rng, d);
  return numericItem(ctx, { ro: built.ro, en: built.en }, built.answer);
};

/* ------------------------------------------------------------------ */
/*  Lever, resistors                                                   */
/* ------------------------------------------------------------------ */

export const fizLever: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  void params;
  const d1 = randInt(rng, 2, 8);
  const d2 = pick(rng, [1, 2, 4, 5].filter((x) => x !== d1));
  const n = randInt(rng, 1, 12);
  const F1 = d2 * n * 5;
  const F2 = n * 5 * d1;
  if (d >= 2 && rng() < 0.4) {
    return numericItem(
      ctx,
      {
        ro: `O pârghie este în echilibru (F1 · d1 = F2 · d2). Se știe: F1 = ${F1} N, d1 = ${d1} m, F2 = ${F2} N. Calculează brațul d2 (în m).`,
        en: `A lever is balanced (F1 · d1 = F2 · d2). Given: F1 = ${F1} N, d1 = ${d1} m, F2 = ${F2} N. Find the arm d2 (in m).`,
      },
      d2,
    );
  }
  return numericItem(
    ctx,
    {
      ro: `O pârghie este în echilibru (F1 · d1 = F2 · d2). Se știe: F1 = ${F1} N, d1 = ${d1} m, d2 = ${d2} m. Calculează forța F2 (în N).`,
      en: `A lever is balanced (F1 · d1 = F2 · d2). Given: F1 = ${F1} N, d1 = ${d1} m, d2 = ${d2} m. Find the force F2 (in N).`,
    },
    F2,
  );
};

/** Parallel pairs with an integer equivalent resistance */
const PARALLEL: [number, number, number][] = [
  [6, 3, 2], [12, 4, 3], [12, 6, 4], [20, 5, 4], [30, 15, 10], [10, 10, 5], [8, 8, 4], [4, 4, 2], [30, 20, 12], [60, 20, 15], [6, 6, 3], [40, 10, 8],
];

export const fizResistors: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, listParam(params, 'mode', ['series', 'parallel']));
  if (mode === 'parallel') {
    const [a, b, eq] = pick(rng, PARALLEL);
    return numericItem(
      ctx,
      {
        ro: `Două rezistoare, R1 = ${a} Ω și R2 = ${b} Ω, sunt legate în paralel. Calculează rezistența echivalentă (în Ω).`,
        en: `Two resistors, R1 = ${a} Ω and R2 = ${b} Ω, are connected in parallel. Find the equivalent resistance (in Ω).`,
      },
      eq,
    );
  }
  const count = d >= 2 && rng() < 0.5 ? 3 : 2;
  const rs = Array.from({ length: count }, () => randInt(rng, 1, 20) * 5);
  const list = rs.map((x, i) => `R${i + 1} = ${x} Ω`);
  const listEn = list.length === 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  const listRo = list.length === 2 ? list.join(' și ') : `${list.slice(0, -1).join(', ')} și ${list[list.length - 1]}`;
  return numericItem(
    ctx,
    {
      ro: `${count === 2 ? 'Două' : 'Trei'} rezistoare, ${listRo}, sunt legate în serie. Calculează rezistența echivalentă (în Ω).`,
      en: `${count === 2 ? 'Two' : 'Three'} resistors, ${listEn}, are connected in series. Find the equivalent resistance (in Ω).`,
    },
    rs.reduce((s, x) => s + x, 0),
  );
};

/* ------------------------------------------------------------------ */
/*  Reading instruments, areas and volumes                             */
/* ------------------------------------------------------------------ */

export const fizRead: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kind = pick(rng, listParam(params, 'kind', ['ruler']));
  if (kind === 'ruler') {
    const to = pick(rng, [10, 15, 20]);
    const from = d >= 3 && rng() < 0.5 ? randInt(rng, 1, 4) : 0;
    const end = randInt(rng, from + 2, to - 1);
    const visual: VisualSpec = { kind: 'ruler', to, unit: 'cm', ...(from ? { from } : {}), objectEnd: end, objectLabel: { ro: 'obiectul', en: 'the object' } };
    return numericItem(
      ctx,
      { ro: `Cât măsoară obiectul de pe riglă (în cm)?${from ? ' Atenție: nu începe de la 0.' : ''}`, en: `How long is the object on the ruler (in cm)?${from ? ' Careful: it does not start at 0.' : ''}` },
      end - from,
      visual,
    );
  }
  if (kind === 'thermo') {
    const mode = d <= 1 ? 'read' : pick(rng, ['read', 'diff', 'kelvin']);
    if (mode === 'diff') {
      const a = randInt(rng, -4, 6) * 5;
      const b = a + randInt(rng, 2, 10) * 5;
      return numericItem(
        ctx,
        { ro: `Temperatura unui corp crește de la ${a} °C la ${b} °C. Cu câte grade Celsius a crescut?`, en: `The temperature of a body rises from ${a} °C to ${b} °C. By how many degrees Celsius did it rise?` },
        b - a,
      );
    }
    if (mode === 'kelvin') {
      const t = randInt(rng, 0, 20) * 5;
      return numericItem(
        ctx,
        { ro: `Transformă în kelvin: ${t} °C = ? K (T = t + 273).`, en: `Convert to kelvin: ${t} °C = ? K (T = t + 273).` },
        t + 273,
      );
    }
    const t = randInt(rng, -4, 12) * 5;
    return numericItem(
      ctx,
      { ro: 'Ce temperatură indică săgeata de pe axa termometrului (în °C)?', en: 'What temperature does the mark on the thermometer scale show (in °C)?' },
      t,
      { kind: 'number-line', from: -20, to: 60, step: 10, marks: [t] },
    );
  }
  if (kind === 'area') {
    const a = randInt(rng, 3, 12);
    const b = randInt(rng, 2, 9);
    const mode = pick(rng, ['area', 'perimeter', ...(d >= 2 ? ['volume'] : [])]);
    if (mode === 'volume') {
      const h = randInt(rng, 2, 6);
      return numericItem(
        ctx,
        { ro: `Un cuboid are lungimea ${a} cm, lățimea ${b} cm și înălțimea ${h} cm. Calculează volumul (în cm³).`, en: `A cuboid is ${a} cm long, ${b} cm wide and ${h} cm high. Find its volume (in cm³).` },
        a * b * h,
      );
    }
    const visual: VisualSpec = { kind: 'shape', shape: 'rectangle', sides: [a, b, a, b], unit: 'cm' };
    return numericItem(
      ctx,
      mode === 'area'
        ? { ro: `Un dreptunghi are lungimea ${a} cm și lățimea ${b} cm. Calculează aria (în cm²).`, en: `A rectangle is ${a} cm long and ${b} cm wide. Find its area (in cm²).` }
        : { ro: `Un dreptunghi are lungimea ${a} cm și lățimea ${b} cm. Calculează perimetrul (în cm).`, en: `A rectangle is ${a} cm long and ${b} cm wide. Find its perimeter (in cm).` },
      mode === 'area' ? a * b : 2 * (a + b),
      visual,
    );
  }
  throw new Error(`fiz-read: unknown kind "${kind}" (skill ${ctx.skill.id})`);
};

registerGenerator('fiz-convert', fizConvert);
registerGenerator('fiz-calc', fizCalc);
registerGenerator('fiz-lever', fizLever);
registerGenerator('fiz-resistors', fizResistors);
registerGenerator('fiz-read', fizRead);
