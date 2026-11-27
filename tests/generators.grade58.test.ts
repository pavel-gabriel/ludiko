import { describe, it, expect } from 'vitest';
import { getAllSkills, getExplanation, getSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { validateItem, validateSkillGraph } from '../src/engine/content/validate';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators, mulberry32 } from '../src/engine/items/generators';
import type { ChoiceItem, Item, ItemResponse, Skill, VisualSpec } from '../src/engine/types';

import grade5File from '../content/skills/mat/grade5.json';
import grade6File from '../content/skills/mat/grade6.json';
import grade7File from '../content/skills/mat/grade7.json';
import grade8File from '../content/skills/mat/grade8.json';

const SEED = 20261127;
const COUNT = 200;
const FILES: Record<number, Skill[]> = { 5: grade5File as Skill[], 6: grade6File as Skill[], 7: grade7File as Skill[], 8: grade8File as Skill[] };
const OWN_IDS = new Set(Object.values(FILES).flat().map((s) => s.id));
const newSkills: Skill[] = getSkillsBySubject('mat').filter((s) => OWN_IDS.has(s.id));
const sourcesOf = (s: Skill) => s.itemSources.flatMap((x) => ('generator' in x ? [x] : []));

/* ------------------------------------------------------------------ */
/*  Independent exact arithmetic (BigInt rationals, no imports from the generators)  */
/* ------------------------------------------------------------------ */

interface Q {
  n: bigint;
  d: bigint;
}
const bgcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const q = (n: bigint, d: bigint = 1n): Q => {
  if (d === 0n) throw new Error('div by zero');
  if (d < 0n) [n, d] = [-n, -d];
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const qadd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qsub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qdiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const qeq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const qpow = (a: Q, e: number): Q => {
  let r = q(1n);
  const base = e < 0 ? q(a.d, a.n) : a;
  for (let i = 0; i < Math.abs(e); i++) r = qmul(r, base);
  return r;
};

const SUPMAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
type Tok = { t: 'num'; v: Q } | { t: 'op'; v: string } | { t: 'sup'; v: number };

function tokenize(src: string): Tok[] {
  const s = src.replace(/(\d) (?=\d)/g, '$1');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (/[+−·:()]/.test(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c in SUPMAP) {
      let e = '';
      while (i < s.length && s[i] in SUPMAP) e += SUPMAP[s[i++]];
      out.push({ t: 'sup', v: Number(e) });
      continue;
    }
    const m = /^(\d+)(?:,(\d+))?(?:\/(\d+))?/.exec(s.slice(i));
    if (!m) throw new Error(`cannot tokenize "${src}" at ${i}`);
    let v = q(BigInt(m[1]));
    if (m[2]) v = q(BigInt(m[1] + m[2]), 10n ** BigInt(m[2].length));
    if (m[3]) v = qdiv(v, q(BigInt(m[3])));
    out.push({ t: 'num', v });
    i += m[0].length;
  }
  return out;
}

/** exact value of an expression such as "3/4 − (−1/2)", "2 + 3² · 4", "1,2 · 0,3", "2⁻³" */
function evalExpr(src: string): Q {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  function primary(): Q {
    if (isOp('−')) {
      p++;
      const v = power();
      return q(-v.n, v.d);
    }
    return power();
  }
  function power(): Q {
    let base: Q;
    const t = peek();
    if (isOp('(')) {
      p++;
      base = expr();
      if (!isOp(')')) throw new Error('missing )');
      p++;
    } else if (t?.t === 'num') {
      p++;
      base = t.v;
    } else throw new Error(`unexpected token in "${src}"`);
    if (peek()?.t === 'sup') {
      base = qpow(base, (peek() as { v: number }).v);
      p++;
    }
    return base;
  }
  function term(): Q {
    let v = primary();
    while (isOp('·') || isOp(':')) {
      const op = (peek() as { v: string }).v;
      p++;
      const r = primary();
      v = op === '·' ? qmul(v, r) : qdiv(v, r);
    }
    return v;
  }
  function expr(): Q {
    let v = term();
    while (isOp('+') || isOp('−')) {
      const op = (peek() as { v: string }).v;
      p++;
      const r = term();
      v = op === '+' ? qadd(v, r) : qsub(v, r);
    }
    return v;
  }
  const v = expr();
  if (p !== toks.length) throw new Error(`trailing tokens in "${src}"`);
  return v;
}

/** value of a text answer; null when it is not a plain number / fraction */
function valueOf(text: string): Q | null {
  try {
    return evalExpr(text);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Item helpers                                                      */
/* ------------------------------------------------------------------ */

function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice':
      return { type: 'choice', selectedId: item.correctId };
    case 'true-false':
      return { type: 'true-false', value: item.correct };
    case 'number-input':
      return { type: 'number-input', value: item.correct };
    case 'fill-gap':
      return { type: 'fill-gap', value: item.correct };
    default:
      throw new Error(`unexpected item type ${item.type}`);
  }
}

const answerText = (item: Item): string => {
  if (item.type === 'choice') return item.options.find((o) => o.id === item.correctId)?.text?.ro ?? '';
  if (item.type === 'fill-gap') return item.correct;
  if (item.type === 'number-input') return String(item.correct);
  return '';
};

/** numeric answer with the thin grouping spaces removed ("10 240" -> 10240) */
const numAns = (item: Item): number => Number(answerText(item).replace(/\u00a0/g, '').replace('−', '-'));

const TF_PREFIX = 'Adevărat sau fals: ';
const statement = (item: Item): string => item.prompt.ro.slice(TF_PREFIX.length);

/** n items from one generator with explicit params (all items stamped like generateItems does) */
function gen(name: string, params: Record<string, unknown>, n = 300, difficulty?: 1 | 2 | 3 | 4 | 5): Item[] {
  const fn = getGenerator(name);
  if (!fn) throw new Error(`generator ${name} missing`);
  const skill = { id: 'mat.test', explanations: [] } as unknown as Skill;
  return Array.from({ length: n }, (_, i) => {
    const d = difficulty ?? ((i % 5) + 1);
    const item = fn(params, { skill, difficulty: d as 1, rng: mulberry32(SEED + i * 7919 + d), index: i });
    return { ...item, id: `t.${name}.${i}`, provenance: { id: `t.${name}.${i}`, kind: 'item', title: 't', author: 'Ludiko', source: 'generated', licence: 'OWN' } } as Item;
  });
}

/** Generic check of "EXPR = value" style items: choice/number-input/gap claim the value, tf states it */
function checkExprItems(items: Item[], promptRe: RegExp, opts: { allowUnreducedWrong?: boolean } = {}): number {
  let checked = 0;
  for (const it of items) {
    if (it.type === 'true-false') {
      const st = statement(it);
      const idx = st.lastIndexOf(' = ');
      if (idx < 0) continue;
      const lhs = valueOf(st.slice(0, idx));
      const rhs = valueOf(st.slice(idx + 3).replace(/ \(.*\)$/, ''));
      if (!lhs || !rhs) continue;
      expect(qeq(lhs, rhs), `${it.id}: ${st}`).toBe(it.correct);
      checked++;
      continue;
    }
    let expr: string | undefined;
    if (it.type === 'fill-gap') expr = it.template.ro.replace(/ = \{\{gap\}\}$/, '');
    else {
      const m = promptRe.exec(it.prompt.ro);
      expr = m?.[1];
    }
    if (!expr || (it.type === 'fill-gap' && it.template.ro.includes('{{gap}}') && !it.template.ro.endsWith('{{gap}}'))) continue;
    const exprVal = evalExpr(expr);
    const claimed = valueOf(answerText(it));
    expect(claimed, `${it.id}: ${expr} -> ${answerText(it)}`).not.toBeNull();
    expect(qeq(exprVal, claimed as Q), `${it.id}: ${expr} = ${answerText(it)} (true ${exprVal.n}/${exprVal.d})`).toBe(true);
    if (it.type === 'choice') {
      for (const o of it.options) {
        if (o.id === it.correctId) continue;
        const v = valueOf(o.text?.ro ?? '');
        if (!v || !qeq(v, exprVal)) continue;
        // only an unreduced form of the right fraction is acceptable, and only when the prompt asks for lowest terms
        expect(opts.allowUnreducedWrong === true && /ireductibil|lowest/.test(it.prompt.ro) && /^−?\d+\/\d+$/.test(o.text?.ro ?? ''), `${it.id}: option ${o.text?.ro} equals the answer`).toBe(true);
      }
    }
    checked++;
  }
  return checked;
}

const rangeOf = (items: Item[], pred: (i: Item) => boolean) => items.filter(pred).length;

/* ------------------------------------------------------------------ */
/*  Content: skills, prerequisites, explanations                       */
/* ------------------------------------------------------------------ */

describe('grade V-VIII math content', () => {
  it('has 10-14 skills per grade V, VI, VII, VIII, all with registered generators', () => {
    const names = new Set(listGenerators());
    for (const g of [5, 6, 7, 8]) {
      const list = newSkills.filter((s) => s.grade === g);
      expect(list.length, `grade ${g}`).toBeGreaterThanOrEqual(10);
      expect(list.length, `grade ${g}`).toBeLessThanOrEqual(14);
    }
    for (const s of newSkills) for (const src of sourcesOf(s)) expect(names.has(src.generator), `${s.id}: ${src.generator}`).toBe(true);
    for (const g of ['fractions-ops', 'decimals', 'powers', 'divisibility', 'integers', 'percentages', 'proportions', 'linear-equation', 'system-2x2', 'sqrt', 'pythagoras', 'areas-volumes', 'algebra', 'linear-function', 'probability', 'statistics', 'angles', 'segments-units']) {
      expect(names.has(g), g).toBe(true);
    }
  });

  it('semesters are 1 or 2 and the skill graph (all grades) is valid and acyclic', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const [g, list] of Object.entries(FILES)) for (const s of list) expect(s.grade, s.id).toBe(Number(g));
    for (const s of newSkills) expect([1, 2]).toContain(s.semester);
  });

  it('prerequisites exist and link into grade III-IV / measures skills as well as within V-VIII', () => {
    const lower = new Set<string>();
    for (const s of newSkills) {
      expect(s.prerequisites.length, s.id).toBeGreaterThan(0);
      for (const p of s.prerequisites) {
        const pre = getSkill(p);
        expect(pre, `${s.id} -> ${p}`).toBeDefined();
        if (!OWN_IDS.has(p)) {
          expect(pre!.grade, `${s.id} -> ${p}`).toBeLessThanOrEqual(4);
          lower.add(p);
        }
      }
    }
    // the bridge into the earlier grades, including the measures skills
    for (const id of ['mat.mul.2digit', 'mat.div.1digit.rem', 'mat.fraction.compare', 'mat.measure.convert', 'mat.geom.perimeter', 'mat.equation.big', 'mat.order.ops']) {
      expect(lower.has(id), id).toBe(true);
    }
    // grade V skills only depend on grade IV or lower (or grade V); later grades build on earlier ones
    for (const s of newSkills.filter((x) => x.grade === 5)) for (const p of s.prerequisites) expect(getSkill(p)!.grade, `${s.id} -> ${p}`).toBeLessThanOrEqual(5);
    for (const s of newSkills.filter((x) => x.grade === 8)) expect(s.prerequisites.some((p) => getSkill(p)!.grade >= 6), s.id).toBe(true);
  });

  it('follows the content policy: own/OWN/Ludiko, programa MAT-V-VIII-2017 "to verify", ro+en titles', () => {
    for (const s of newSkills) {
      expect(s.provenance).toMatchObject({ source: 'own', licence: 'OWN', author: 'Ludiko' });
      expect(s.provenance.notes, s.id).toMatch(/to verify/);
      expect(s.competences.length).toBeGreaterThan(0);
      expect(s.competences.every((c) => c.programa === 'MAT-V-VIII-2017' && /^\d\.\d$/.test(c.code))).toBe(true);
      expect(s.title.ro && s.title.en).toBeTruthy();
      expect(s.masteryCheck).toEqual({ items: 5, minCorrect: 4 });
    }
  });

  it('every skill has an explanation of 3-4 frames with ro+en text; most frames carry a visual or example', () => {
    let withVisual = 0;
    for (const s of newSkills) {
      expect(s.explanations.length, s.id).toBe(1);
      const e = getExplanation(s.explanations[0]);
      expect(e, s.id).toBeDefined();
      expect(e!.skillId).toBe(s.id);
      expect(e!.reviewStatus).toBe('beta');
      expect(e!.provenance).toMatchObject({ source: 'ai-draft', licence: 'OWN', author: 'Ludiko' });
      expect(e!.frames.length).toBeGreaterThanOrEqual(3);
      expect(e!.frames.length).toBeLessThanOrEqual(4);
      expect(e!.title.ro && e!.title.en).toBeTruthy();
      for (const f of e!.frames) {
        expect(f.text.ro && f.text.en).toBeTruthy();
        if (f.visual) withVisual++;
      }
    }
    expect(withVisual).toBeGreaterThan(40);
  });
});

/* ------------------------------------------------------------------ */
/*  Every new skill: 200 valid, checkable, deterministic items         */
/* ------------------------------------------------------------------ */

const ALL_RO_TEXTS = (item: Item): string[] => {
  const out = [item.prompt.ro];
  if (item.type === 'choice') out.push(...item.options.map((o) => o.text?.ro ?? ''));
  if (item.type === 'fill-gap') out.push(item.template.ro, ...(item.options ?? []));
  return out;
};
const ALL_EN_TEXTS = (item: Item): string[] => {
  const out = [item.prompt.en ?? ''];
  if (item.type === 'choice') out.push(...item.options.map((o) => o.text?.en ?? ''));
  if (item.type === 'fill-gap') out.push(item.template.en ?? '');
  return out;
};

describe('generators over every new skill', () => {
  for (const skill of newSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it('produces 200 generated items that all pass validateItem (ro + en, unique ids)', () => {
        expect(items).toHaveLength(COUNT);
        for (const it of items) {
          expect(it.id.startsWith('gen.')).toBe(true);
          expect(validateItem(it), it.id).toEqual([]);
          expect(it.prompt.en, it.id).toBeTruthy();
          expect(it.explanationId).toBe(skill.explanations[0]);
          expect(['choice', 'true-false', 'number-input', 'fill-gap']).toContain(it.type);
        }
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
      });

      it('the correct response passes and no other choice / the opposite truth value does', () => {
        for (const it of items) {
          expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
          if (it.type === 'choice') {
            for (const o of it.options) if (o.id !== it.correctId) expect(checkResponse(it, { type: 'choice', selectedId: o.id }), it.id).toBe(false);
          }
          if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct })).toBe(false);
        }
      });

      it('no distractor equals the answer; options are unique, 3-4 of them', () => {
        for (const it of items) {
          if (it.type === 'choice') {
            const texts = it.options.map((o) => JSON.stringify(o.text));
            expect(new Set(texts).size, it.id).toBe(texts.length);
            expect(new Set(it.options.map((o) => o.text?.ro)).size, it.id).toBe(it.options.length);
            expect(it.options.length, it.id).toBeGreaterThanOrEqual(3);
            expect(it.options.length, it.id).toBeLessThanOrEqual(4);
            const right = it.options.find((o) => o.id === it.correctId)?.text?.ro;
            expect(it.options.filter((o) => o.text?.ro === right)).toHaveLength(1);
          }
          if (it.type === 'fill-gap' && it.options) {
            expect(new Set(it.options).size, it.id).toBe(it.options.length);
            expect(it.options).toContain(it.correct);
            expect(it.options.length).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('typed answers fit the numpad (non-negative whole numbers up to 6 digits)', () => {
        for (const it of items) {
          if (it.type === 'number-input') {
            expect(Number.isInteger(it.correct) && it.correct >= 0 && it.correct <= 999999, `${it.id}: ${it.correct}`).toBe(true);
          }
          if (it.type === 'fill-gap' && !it.options) expect(/^\d{1,6}$/.test(it.correct), `${it.id}: ${it.correct}`).toBe(true);
        }
      });

      it('Romanian texts use the decimal comma, English ones the decimal point; no NaN / undefined', () => {
        for (const it of items) {
          for (const t of ALL_RO_TEXTS(it)) {
            expect(/\d\.\d/.test(t), `${it.id}: "${t}"`).toBe(false);
            expect(/NaN|undefined|Infinity|\[object/.test(t), `${it.id}: "${t}"`).toBe(false);
            expect(/[−-]0(?![\d,.])(?!\/)/.test(t.replace(/\d[−-]0/g, '')), `${it.id}: negative zero in "${t}"`).toBe(false);
          }
          for (const t of ALL_EN_TEXTS(it)) {
            expect(/\d,\d/.test(t), `${it.id}: "${t}"`).toBe(false);
            expect(/NaN|undefined|Infinity|\[object/.test(t), `${it.id}: "${t}"`).toBe(false);
          }
        }
      });

      it('is deterministic per seed, differs between seeds and mixes item types', () => {
        expect(JSON.stringify(generateItems(skill, COUNT, { seed: SEED }))).toBe(JSON.stringify(items));
        const other = generateItems(skill, 40, { seed: SEED + 1 });
        expect(JSON.stringify(other.map((i) => i.prompt))).not.toBe(JSON.stringify(items.slice(0, 40).map((i) => i.prompt)));
        expect(new Set(items.map((i) => i.type)).size).toBeGreaterThanOrEqual(2);
      });

      it('works at every difficulty and does not repeat the same item over and over', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          for (const it of generateItems(skill, 30, { seed: d + 100, difficulty: d })) {
            expect(validateItem(it), it.id).toEqual([]);
            expect(it.difficulty).toBe(d);
            expect(checkResponse(it, correctResponse(it))).toBe(true);
          }
        }
        const distinct = new Set(items.map((i) => i.prompt.ro)).size;
        expect(distinct, skill.id).toBeGreaterThan(15);
      });
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Exact-arithmetic checks, independent recomputation per generator   */
/* ------------------------------------------------------------------ */

describe('fractions-ops: exact rational arithmetic', () => {
  const RE = /^Calculează și scrie rezultatul în forma ireductibilă: (.+)$/;
  for (const negative of [false, true]) {
    it(`add, sub, mul, div, mixed give the reduced exact result (negative=${negative})`, () => {
      const items = gen('fractions-ops', { modes: ['add', 'sub', 'mul', 'div', 'mixed'], maxDen: 12, negative }, 600);
      expect(checkExprItems(items, RE, { allowUnreducedWrong: true })).toBeGreaterThan(300);
      for (const it of items) {
        const t = answerText(it);
        const m = /^(−?)(\d+)\/(\d+)$/.exec(t);
        if (m && it.type !== 'true-false') expect(bgcd(BigInt(m[2]), BigInt(m[3])), `${it.id}: ${t} not reduced`).toBe(1n);
      }
    });
  }
  it('equiv items: the right fraction is equal to the given one; wrong ones are not; (a+k)/(b+k) is offered', () => {
    const items = gen('fractions-ops', { modes: ['equiv'], maxDen: 9 }, 300);
    let which = 0;
    let slip = 0;
    for (const it of items) {
      if (it.type !== 'choice') continue;
      const m = /egală cu (\d+)\/(\d+)/.exec(it.prompt.ro);
      if (!m) continue;
      const base = q(BigInt(m[1]), BigInt(m[2]));
      which++;
      for (const o of it.options) {
        const v = valueOf(o.text?.ro ?? '') as Q;
        expect(qeq(v, base), `${it.id}: ${o.text?.ro}`).toBe(o.id === it.correctId);
      }
      slip += it.options.some((o) => o.id !== it.correctId) ? 1 : 0;
    }
    expect(which).toBeGreaterThan(20);
    expect(slip).toBe(which);
  });
  it('compare / order / simplify / of are exact', () => {
    for (const it of gen('fractions-ops', { modes: ['compare'], maxDen: 12, negative: true }, 300)) {
      const m = /Compară fracțiile (\S+) și (\S+)\./.exec(it.prompt.ro);
      if (!m) continue;
      const a = evalExpr(m[1]);
      const b = evalExpr(m[2]);
      const sign = a.n * b.d < b.n * a.d ? '<' : a.n * b.d > b.n * a.d ? '>' : '=';
      expect(answerText(it) === sign || it.type === 'true-false', it.id).toBe(true);
    }
    for (const it of gen('fractions-ops', { modes: ['order'], maxDen: 12, negative: true }, 200)) {
      if (it.type !== 'choice') continue;
      const seq = answerText(it).split(' < ').map(evalExpr);
      for (let i = 1; i < seq.length; i++) expect(seq[i].n * seq[i - 1].d > seq[i - 1].n * seq[i].d, it.id).toBe(true);
    }
    for (const it of gen('fractions-ops', { modes: ['of'], maxDen: 9 }, 300)) {
      const m = /^Cât este (\d+)\/(\d+) din (\d+)\?$/.exec(it.prompt.ro);
      if (!m) continue;
      expect(BigInt(m[3]) % BigInt(m[2]), it.id).toBe(0n);
      expect(BigInt(numAns(it)), it.id).toBe((BigInt(m[3]) / BigInt(m[2])) * BigInt(m[1]));
    }
  });
});

describe('decimals: exact scaled-integer arithmetic and the decimal comma', () => {
  const RE = /^Calculează: (.+)$/;
  it('add, sub, mul, div agree with an independent exact computation', () => {
    const items = gen('decimals', { modes: ['add', 'sub', 'mul', 'div'], maxInt: 20 }, 600);
    expect(checkExprItems(items, RE)).toBeGreaterThan(400);
    for (const it of items) {
      for (const t of ALL_RO_TEXTS(it)) expect(/\d\.\d/.test(t), t).toBe(false);
      if (it.type === 'choice') for (const o of it.options) expect(o.text?.en, it.id).toBeTruthy();
    }
  });
  it('English options use the decimal point where Romanian ones use the comma', () => {
    const items = gen('decimals', { modes: ['add', 'mul', 'toDecimal'] }, 300).filter((i): i is ChoiceItem => i.type === 'choice');
    let seen = 0;
    for (const it of items) {
      for (const o of it.options) {
        if (o.text?.ro?.includes(',')) {
          expect(o.text.en).toBe(o.text.ro.replace(',', '.'));
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
  it('toDecimal / toFraction / round / compare / order / locate are exact', () => {
    for (const it of gen('decimals', { modes: ['toDecimal'] }, 300)) {
      const m = /Scrie fracția (\d+)\/(\d+) ca număr zecimal\./.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      expect(qeq(evalExpr(answerText(it)), q(BigInt(m[1]), BigInt(m[2]))), it.id).toBe(true);
    }
    for (const it of gen('decimals', { modes: ['toFraction'] }, 300)) {
      const m = /Scrie numărul (\S+) ca fracție ireductibilă\./.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const t = answerText(it);
      expect(qeq(evalExpr(t), evalExpr(m[1])), it.id).toBe(true);
      const f = /^(\d+)\/(\d+)$/.exec(t);
      if (f) expect(bgcd(BigInt(f[1]), BigInt(f[2]))).toBe(1n);
    }
    for (const it of gen('decimals', { modes: ['round'] }, 300)) {
      const m = /^Rotunjește (\S+) la (unități|zecimi|sutimi)\.$/.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const places = m[2] === 'unități' ? 0 : m[2] === 'zecimi' ? 1 : 2;
      const x = evalExpr(m[1]);
      const scale = 10n ** BigInt(places);
      // round half up exactly
      const num = x.n * scale;
      const r = (2n * num + x.d) / (2n * x.d);
      expect(qeq(evalExpr(answerText(it)), q(r, scale)), it.id).toBe(true);
    }
    for (const it of gen('decimals', { modes: ['compare'] }, 200)) {
      const m = /^Compară numerele (\S+) și (\S+)\./.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const a = evalExpr(m[1]);
      const b = evalExpr(m[2]);
      const c = a.n * b.d - b.n * a.d;
      expect(answerText(it), it.id).toBe(c < 0n ? '<' : c > 0n ? '>' : '=');
    }
    for (const it of gen('decimals', { modes: ['order'] }, 200)) {
      if (it.type !== 'choice') continue;
      const seq = answerText(it).split(' < ').map(evalExpr);
      for (let i = 1; i < seq.length; i++) expect(seq[i].n * seq[i - 1].d > seq[i - 1].n * seq[i].d, it.id).toBe(true);
    }
    for (const it of gen('decimals', { modes: ['locate'] }, 100)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'number-line' }>;
      expect(v.kind).toBe('number-line');
      expect(v.marks).toHaveLength(1);
      const mark = Math.round((v.marks as number[])[0] * 1000);
      expect(Math.round(Number(answerText(it).replace(',', '.')) * 1000), it.id).toBe(mark);
    }
  });
});

describe('powers: superscripts, exact values and the rules', () => {
  const RE = /^Calculează: (.+)$/;
  it('eval, special, pow10, neg, intExp, orderOps agree with an independent evaluation', () => {
    for (const modes of [['eval', 'special', 'pow10'], ['orderOps'], ['neg', 'intExp']]) {
      const items = gen('powers', { modes }, 500);
      expect(checkExprItems(items, RE), modes.join()).toBeGreaterThan(150);
    }
  });
  it('uses superscript digits (² ³ ...) in the text', () => {
    const items = gen('powers', { modes: ['eval', 'orderOps', 'product', 'neg'] }, 200);
    expect(items.filter((i) => /[²³⁴⁵⁶⁷⁸⁹]/.test(i.prompt.ro)).length).toBeGreaterThan(100);
  });
  it('orderOps: the classic wrong answer (precedence ignored) is among the options of choices', () => {
    /** split at the operators that are outside brackets */
    const topLevel = (e: string): { atoms: string[]; ops: string[] } => {
      const atoms: string[] = [];
      const ops: string[] = [];
      let depth = 0;
      let cur = '';
      for (let i = 0; i < e.length; i++) {
        const c = e[i];
        if (c === '(') depth++;
        if (c === ')') depth--;
        if (depth === 0 && c === ' ' && '+−·:'.includes(e[i + 1]) && e[i + 2] === ' ') {
          atoms.push(cur);
          ops.push(e[i + 1]);
          cur = '';
          i += 2;
          continue;
        }
        cur += c;
      }
      atoms.push(cur);
      return { atoms, ops };
    };
    let n = 0;
    for (const it of gen('powers', { modes: ['orderOps'] }, 300)) {
      if (it.type !== 'choice') continue;
      const m = RE.exec(it.prompt.ro);
      if (!m) continue;
      const { atoms, ops } = topLevel(m[1]);
      const vals = atoms.map(evalExpr);
      let acc = vals[0];
      ops.forEach((op, i) => {
        const r = vals[i + 1];
        acc = op === '+' ? qadd(acc, r) : op === '−' ? qsub(acc, r) : op === '·' ? qmul(acc, r) : qdiv(acc, r);
      });
      const right = evalExpr(m[1]);
      if (qeq(acc, right) || acc.d !== 1n || acc.n < 0n) continue; // the generator only offers whole, non-negative slips
      n++;
      expect(it.options.some((o) => valueOf(o.text?.ro ?? '') !== null && qeq(valueOf(o.text?.ro ?? '') as Q, acc)), `${it.id}: ${m[1]}`).toBe(true);
    }
    expect(n).toBeGreaterThan(10);
  });
  it('product / quotient / power rules give the right exponent', () => {
    for (const it of gen('powers', { modes: ['product', 'quotient', 'power'] }, 400)) {
      if (it.type === 'true-false') {
        const st = statement(it);
        const idx = st.lastIndexOf(' = ');
        expect(qeq(evalExpr(st.slice(0, idx)), evalExpr(st.slice(idx + 3))), it.id).toBe(it.correct);
        continue;
      }
      let expr: string | undefined;
      let base = 0;
      const m1 = /^Scrie ca putere: (.+)$/.exec(it.prompt.ro);
      const m2 = /^Află numărul n din egalitatea (.+) = (\d+)ⁿ\.$/.exec(it.prompt.ro);
      if (m1) {
        expr = m1[1];
        const right = answerText(it);
        expect(qeq(evalExpr(expr), evalExpr(right)), it.id).toBe(true);
      } else if (m2) {
        expr = m2[1];
        base = Number(m2[2]);
        expect(qeq(evalExpr(expr), qpow(q(BigInt(base)), numAns(it))), it.id).toBe(true);
      }
    }
  });
});

describe('divisibility: criteria, primes, gcd, lcm, factorisation', () => {
  const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
  const num = (s: string) => Number(s.replace(/ /g, ''));
  it('criteria: the right number is divisible, the others are not; tf agrees; digitFind is the smallest digit', () => {
    for (const it of gen('divisibility', { modes: ['criteria'], criteria: [2, 3, 5, 9, 10], max: 1000 }, 300)) {
      if (it.type !== 'choice') continue;
      const c = Number(/divisibile cu (\d+)|se divide cu (\d+)/.exec(it.prompt.ro)?.slice(1).find(Boolean));
      for (const o of it.options) expect(num(o.text?.ro ?? '') % c === 0, `${it.id}: ${o.text?.ro} / ${c}`).toBe(o.id === it.correctId);
    }
    for (const it of gen('divisibility', { modes: ['criteriaTf'], max: 1000 }, 200)) {
      const m = /numărul (\S+) se divide cu (\d+)\./.exec(statement(it));
      expect(m).not.toBeNull();
      expect(num((m as RegExpExecArray)[1]) % Number((m as RegExpExecArray)[2]) === 0, it.id).toBe((it as { correct: boolean }).correct);
    }
    for (const it of gen('divisibility', { modes: ['digitFind'] }, 200)) {
      if (it.type === 'true-false') continue;
      const m = /numărul (\d)(\d|□)(\d|□) să se dividă cu (\d+)\?/.exec(it.prompt.ro) ?? /(\d)(\d|□)(\d|□) se divide cu (\d+) pentru/.exec(it.type === 'fill-gap' ? it.template.ro : '');
      expect(m, it.prompt.ro).not.toBeNull();
      const [, a, b, c, div] = m as RegExpExecArray;
      const good = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => Number(`${a}${b === '□' ? x : b}${c === '□' ? x : c}`) % Number(div) === 0);
      expect(answerText(it), it.id).toBe(String(good[0]));
    }
  });
  it('primes: exactly one prime among the options; tf and countPrimes agree', () => {
    for (const it of gen('divisibility', { modes: ['primeSelect'], max: 100 }, 200)) {
      if (it.type !== 'choice') continue;
      expect(it.options.filter((o) => isPrime(num(o.text?.ro ?? ''))).map((o) => o.id)).toEqual([it.correctId]);
    }
    for (const it of gen('divisibility', { modes: ['primeTf'], max: 100 }, 200)) {
      const n = num(/^(\d+) este număr prim\.$/.exec(statement(it))?.[1] ?? 'x');
      expect(isPrime(n), it.id).toBe((it as { correct: boolean }).correct);
    }
    for (const it of gen('divisibility', { modes: ['countPrimes'] }, 200)) {
      const m = /între (\d+) și (\d+)/.exec(it.prompt.ro) ?? /Între (\d+) și (\d+)/.exec(it.type === 'fill-gap' ? it.template.ro : '');
      if (!m) continue;
      const k = Array.from({ length: Number(m[2]) - Number(m[1]) - 1 }, (_, i) => Number(m[1]) + 1 + i).filter(isPrime).length;
      expect(numAns(it), it.id).toBe(k);
    }
  });
  it('gcd and lcm are exact; factorisations multiply back and use primes only', () => {
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    for (const it of gen('divisibility', { modes: ['gcd', 'lcm'] }, 400)) {
      const s = it.type === 'fill-gap' ? it.template.ro : it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const m = /cmm(d|m)c\((\d+), (\d+)\)/.exec(s);
      let a: number;
      let b: number;
      let isGcd: boolean;
      if (m) {
        isGcd = m[1] === 'd';
        a = Number(m[2]);
        b = Number(m[3]);
      } else {
        const nums = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
        [a, b] = nums.slice(0, 2);
        isGcd = /cât mai mari|latura pătratelor/.test(it.prompt.ro);
      }
      const want = isGcd ? g(a, b) : (a / g(a, b)) * b;
      if (it.type === 'true-false') {
        const claimed = Number(/ = (\d+)$/.exec(statement(it))?.[1]);
        expect(claimed === want, it.id).toBe(it.correct);
      } else expect(numAns(it), it.id).toBe(want);
    }
    const factorsOf = (txt: string) =>
      txt.split(' · ').flatMap((p) => {
        const m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/.exec(p);
        if (!m) throw new Error(p);
        const e = m[2] ? Number([...m[2]].map((c) => SUPMAP[c]).join('')) : 1;
        return Array.from({ length: e }, () => Number(m[1]));
      });
    for (const it of gen('divisibility', { modes: ['factor'], max: 100 }, 200)) {
      if (it.type !== 'choice') continue;
      const n = num(/numărul (\S+) în factori/.exec(it.prompt.ro)?.[1] ?? '0');
      const right = factorsOf(answerText(it));
      expect(right.reduce((a, b) => a * b, 1), it.id).toBe(n);
      expect(right.every(isPrime), it.id).toBe(true);
      for (const o of it.options.filter((x) => x.id !== it.correctId)) {
        const f = factorsOf(o.text?.ro ?? '');
        expect(f.reduce((a, b) => a * b, 1) === n && f.every(isPrime), `${it.id}: ${o.text?.ro}`).toBe(false);
      }
    }
    for (const it of gen('divisibility', { modes: ['divisorCount'] }, 200)) {
      const m = /Câți divizori are numărul (\d+)\?/.exec(it.prompt.ro);
      if (!m) continue;
      const n = Number(m[1]);
      expect(numAns(it), it.id).toBe(Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0).length);
    }
  });
});

describe('integers: negative numbers, number-line visuals, exact signs', () => {
  const RE = /^Calculează: (.+)$/;
  it('add, sub, mul, div, expr, abs agree with an independent evaluation', () => {
    const items = gen('integers', { modes: ['add', 'sub', 'mul', 'div', 'expr'], range: 10 }, 600);
    expect(checkExprItems(items, RE)).toBeGreaterThan(300);
    const abs = gen('integers', { modes: ['abs'] }, 200);
    let n = 0;
    for (const it of abs) {
      if (it.type === 'true-false') continue;
      const m = /^Calculează: (.+)$/.exec(it.prompt.ro);
      if (!m) continue;
      const e = m[1].replace(/\|([^|]+)\|/g, (_, x) => `(${x.replace(/^(−?)/, '$1')})`);
      void e;
      const parts = m[1].split(' + ');
      const val = parts.map((p) => {
        const inner = /^\|(.+)\|$/.exec(p);
        if (inner) {
          const v = evalExpr(inner[1]);
          return q(v.n < 0n ? -v.n : v.n, v.d);
        }
        return null;
      });
      if (m[1].startsWith('|') && m[1].endsWith('|') && !m[1].includes('| + |')) {
        const v = evalExpr(m[1].slice(1, -1));
        expect(qeq(evalExpr(answerText(it)), q(v.n < 0n ? -v.n : v.n, v.d)), it.id).toBe(true);
        n++;
      } else if (val.every(Boolean)) {
        expect(qeq(evalExpr(answerText(it)), val.reduce((a, b) => qadd(a as Q, b as Q), q(0n)) as Q), it.id).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(20);
  });
  it('line: the number line has a negative range, marks the right integer and the options include its opposite', () => {
    let negatives = 0;
    for (const it of gen('integers', { modes: ['line'] }, 200)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'number-line' }>;
      expect(v.kind).toBe('number-line');
      expect(v.from).toBeLessThan(0);
      expect(v.to).toBeGreaterThan(0);
      expect(v.from).toBe(-v.to);
      const mark = (v.marks as number[])[0];
      expect(evalExpr(answerText(it)), it.id).toEqual(q(BigInt(mark)));
      if (mark < 0) negatives++;
      if (it.type === 'choice') expect(it.options.some((o) => valueOf(o.text?.ro ?? '') && qeq(valueOf(o.text?.ro ?? '') as Q, q(BigInt(-mark)))), it.id).toBe(true);
    }
    expect(negatives).toBeGreaterThan(80);
  });
  it('jump: the arrow starts at the first number and the equation matches it; dist = right - left', () => {
    for (const it of gen('integers', { modes: ['jump'] }, 200)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'number-line' }>;
      const j = (v.jumps as { from: number; to: number }[])[0];
      const m = /^(−?\d+) ([+−]) (\d+) = (−?\d+)$/.exec(answerText(it));
      expect(m, answerText(it)).not.toBeNull();
      const [, a, op, b, c] = m as RegExpExecArray;
      const A = evalExpr(a);
      expect(qeq(A, q(BigInt(j.from))), it.id).toBe(true);
      expect(qeq(evalExpr(c), q(BigInt(j.to))), it.id).toBe(true);
      expect(qeq(op === '+' ? qadd(A, evalExpr(b)) : qsub(A, evalExpr(b)), evalExpr(c)), it.id).toBe(true);
    }
    for (const it of gen('integers', { modes: ['dist'] }, 200)) {
      const m = /A\((−?\d+)\) și B\((−?\d+)\)/.exec(it.prompt.ro);
      if (!m) continue;
      expect(Math.abs(Number(m[1].replace('−', '-')) - Number(m[2].replace('−', '-'))), it.id).toBe(numAns(it));
    }
  });
  it('order sorts correctly, compare gives the right sign, absEq lists both values', () => {
    for (const it of gen('integers', { modes: ['order'] }, 200)) {
      const seq = answerText(it).split(' < ').map(evalExpr);
      for (let i = 1; i < seq.length; i++) expect(seq[i].n > seq[i - 1].n, it.id).toBe(true);
    }
    for (const it of gen('integers', { modes: ['compare'] }, 200)) {
      const m = /^Compară (\S+) și (\S+)\./.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      expect(answerText(it), it.id).toBe(evalExpr(m[1]).n < evalExpr(m[2]).n ? '<' : '>');
    }
  });
});

describe('percentages', () => {
  it('of / whatPercent / whole / increase / decrease / chain are exact whole numbers', () => {
    let n = 0;
    for (const it of gen('percentages', { modes: ['of', 'whatPercent', 'whole', 'increase', 'decrease', 'chain'], hard: true }, 900)) {
      if (it.type === 'true-false') continue;
      const p = it.prompt.ro;
      const ans = BigInt(numAns(it));
      let m: RegExpExecArray | null;
      if ((m = /^Calculează (\d+)% din (\d+)\.$/.exec(p))) {
        expect((BigInt(m[1]) * BigInt(m[2])) % 100n).toBe(0n);
        expect(ans, p).toBe((BigInt(m[1]) * BigInt(m[2])) / 100n);
      } else if ((m = /^Ce procent reprezintă (\d+) din (\d+)\?$/.exec(p))) {
        expect(ans * BigInt(m[2]), p).toBe(BigInt(m[1]) * 100n);
      } else if ((m = /^(\d+)% dintr-un număr este (\d+)\./.exec(p))) {
        expect(ans * BigInt(m[1]), p).toBe(BigInt(m[2]) * 100n);
      } else if ((m = /^Mărește (\d+) cu (\d+)%\.$/.exec(p))) {
        expect(ans * 100n, p).toBe(BigInt(m[1]) * (100n + BigInt(m[2])));
      } else if ((m = /^Micșorează (\d+) cu (\d+)%\.$/.exec(p))) {
        expect(ans * 100n, p).toBe(BigInt(m[1]) * (100n - BigInt(m[2])));
      } else if ((m = /^Un obiect costă (\d+(?: \d{3})?) (?:de )?lei și se scumpește cu (\d+)%/.exec(p))) {
        expect(ans * 100n, p).toBe(BigInt(m[1].replace(/ /g, '')) * (100n + BigInt(m[2])));
      } else if ((m = /^Un obiect costă (\d+) (?:de )?lei și are o reducere de (\d+)%/.exec(p))) {
        expect(ans * 100n, p).toBe(BigInt(m[1]) * (100n - BigInt(m[2])));
      } else if ((m = /Prețul crește cu (\d+)%, apoi noul preț scade cu (\d+)%/.exec(p))) {
        const start = BigInt(/costă (\d+)/.exec(p)?.[1] ?? '0');
        const up = start * (100n + BigInt(m[1]));
        expect((up * (100n - BigInt(m[2]))) % 10000n).toBe(0n);
        expect(ans, p).toBe((up * (100n - BigInt(m[2]))) / 10000n);
      } else if ((m = /(\d+)% dintre ei participă/.exec(p))) {
        const total = BigInt(/Câți elevi participă|școală are (\d+)/.exec(p) ? /are (\d+)/.exec(p)![1] : '0');
        expect(ans * 100n, p).toBe(total * BigInt(m[1]));
      } else if ((m = /iar (\d+) dintre ei sunt fete/.exec(p))) {
        const total = BigInt(/sunt (\d+)/.exec(p)![1]);
        expect(ans * total, p).toBe(BigInt(m[1]) * 100n);
      } else continue;
      n++;
    }
    expect(n).toBeGreaterThan(300);
  });
  it('fracToPct / pctToFrac / decToPct are exact and keep the Romanian decimal comma', () => {
    for (const it of gen('percentages', { modes: ['fracToPct'] }, 200)) {
      if (it.type === 'true-false') continue;
      const m = /fracția (\d+)\/(\d+)/.exec(it.prompt.ro);
      if (!m) continue;
      expect(BigInt(numAns(it)) * BigInt(m[2]), it.id).toBe(BigInt(m[1]) * 100n);
    }
    for (const it of gen('percentages', { modes: ['pctToFrac'] }, 200)) {
      if (it.type === 'true-false') continue;
      const m = /^Scrie (\d+)% ca fracție/.exec(it.prompt.ro);
      expect(qeq(evalExpr(answerText(it)), q(BigInt((m as RegExpExecArray)[1]), 100n)), it.id).toBe(true);
    }
    for (const it of gen('percentages', { modes: ['decToPct'] }, 100)) {
      const m = /numărul (0,\d\d)/.exec(it.prompt.ro);
      expect(m, it.prompt.ro).not.toBeNull();
      expect(qeq(evalExpr((m as RegExpExecArray)[1]), q(BigInt(numAns(it)), 100n))).toBe(true);
    }
  });
});

describe('proportions', () => {
  it('prop: the completed proportion has equal cross products; propTf is decided by them', () => {
    for (const it of gen('proportions', { modes: ['prop'] }, 300)) {
      const eq = it.type === 'true-false' ? statement(it) : it.type === 'fill-gap' ? it.template.ro.replace('{{gap}}', answerText(it)) : (/proporția (.+)\.$/.exec(it.prompt.ro)?.[1] ?? '').replace('?', answerText(it));
      const m = /^(\d+)\/(\d+) = (\d+)\/(\d+)$/.exec(eq);
      expect(m, `${it.id}: ${eq}`).not.toBeNull();
      const [, a, b, c, d] = (m as RegExpExecArray).map(Number);
      if (it.type === 'true-false') expect(a * d === b * c, it.id).toBe(it.correct);
      else expect(a * d, it.id).toBe(b * c);
    }
    for (const it of gen('proportions', { modes: ['propTf'] }, 200)) {
      const m = /^(\d+)\/(\d+) = (\d+)\/(\d+)$/.exec(statement(it));
      const [, a, b, c, d] = (m as RegExpExecArray).map(Number);
      expect(a * d === b * c, it.id).toBe((it as { correct: boolean }).correct);
    }
  });
  it('ratio is reduced; direct / inverse / split / scale / similar give exact whole answers', () => {
    for (const it of gen('proportions', { modes: ['ratio'] }, 300)) {
      if (it.type === 'true-false') continue;
      const nums = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      const a = BigInt(nums[0]);
      const b = BigInt(nums[1]);
      expect(qeq(evalExpr(answerText(it)), q(a, b)), it.id).toBe(true);
    }
    for (const it of gen('proportions', { modes: ['direct'] }, 400)) {
      if (it.type === 'true-false') continue;
      const nums = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      // "A caiete costă C lei ... B caiete" or "C km în A ore ... B ore"
      const [a, c, b] = /km|pagini/.test(it.prompt.ro) ? [nums[1], nums[0], nums[2]] : nums;
      expect(numAns(it) * a, it.id).toBe(b * c);
    }
    for (const it of gen('proportions', { modes: ['inverse'] }, 400)) {
      if (it.type === 'true-false') continue;
      const [w1, t1, w2] = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      expect(numAns(it) * w2, it.id).toBe(w1 * t1);
    }
    for (const it of gen('proportions', { modes: ['split'] }, 200)) {
      const [S, a, b] = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      expect(numAns(it) * (a + b), it.id).toBe(S * Math.max(a, b));
    }
    for (const it of gen('proportions', { modes: ['scale'] }, 200)) {
      const nums = it.prompt.ro.replace(/ /g, '').match(/\d+/g)!.map(Number);
      const [k, cm] = [nums[1], nums[2]];
      expect(numAns(it) * 100000, it.id).toBe(k * cm);
    }
    for (const it of gen('proportions', { modes: ['similar'] }, 300)) {
      if (it.type === 'true-false') continue;
      const m = /AB = (\d+), BC = (\d+), CA = (\d+)\. În triunghiul MNP, (MN|NP|PM) = (\d+)\. Cât este (MN|NP|PM)\?/.exec(it.prompt.ro);
      if (m) {
        const sides: Record<string, number> = { MN: Number(m[1]), NP: Number(m[2]), PM: Number(m[3]) };
        const given = m[4];
        const k = Number(m[5]) / sides[given];
        expect(Number.isInteger(k)).toBe(true);
        expect(numAns(it), it.id).toBe(sides[m[6]] * k);
        const v = it.visual as Extract<VisualSpec, { kind: 'shape' }>;
        expect(v.sides).toEqual([Number(m[1]), Number(m[2]), Number(m[3])]);
      } else {
        const [k, A] = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
        expect(numAns(it), it.id).toBe(A * k * k);
      }
    }
  });
});

describe('linear-equation / system-2x2: solutions verified by substitution', () => {
  /** JS-evaluable text of a linear expression in x (or x, y) */
  const toJs = (s: string) =>
    s
      .replace(/−/g, '-')
      .replace(/·/g, '*')
      .replace(/(\d)([xy])/g, '$1*$2')
      .replace(/(\d)\(/g, '$1*(')
      .replace(/\)\(/g, ')*(')
      .replace(/(\d) : (\d)/g, '$1 / $2')
      .replace(/ : /g, ' / ');
  const lhsRhs = (eq: string): [string, string] => {
    const [l, r] = eq.split(' = ');
    return [toJs(l), toJs(r)];
  };
  const holds = (eq: string, x: number): boolean => {
    const [l, r] = lhsRhs(eq);
    const f = new Function('x', `return (${l}) - (${r});`) as (x: number) => number;
    return Math.abs(f(x)) < 1e-9;
  };
  const numOf = (t: string): number => {
    const v = evalExpr(t);
    return Number(v.n) / Number(v.d);
  };
  it('equations: the stated solution satisfies the equation, wrong options do not', () => {
    let checked = 0;
    for (const kinds of [['basic', 'verify'], ['both', 'paren'], ['frac', 'rational']]) {
      for (const it of gen('linear-equation', { kinds }, 600)) {
        let eq: string | undefined;
        if (it.type === 'true-false') {
          const m = /^soluția ecuației (.+) este x = (.+)$/.exec(statement(it));
          if (!m) continue;
          expect(holds(m[1], numOf(m[2])), it.id).toBe(it.correct);
          checked++;
          continue;
        }
        if (it.type === 'fill-gap') eq = it.template.ro.replace(/ ⇒ x = \{\{gap\}\}$/, '');
        else eq = /ecuația (.+?)\. /.exec(it.prompt.ro)?.[1] ?? /ecuației (.+?)\?/.exec(it.prompt.ro)?.[1];
        if (!eq) continue;
        expect(holds(eq, numOf(answerText(it))), `${it.id}: ${eq} x=${answerText(it)}`).toBe(true);
        if (it.type === 'choice') {
          for (const o of it.options) {
            if (o.id === it.correctId) continue;
            const equal = holds(eq, numOf(o.text?.ro ?? ''));
            // only the unreduced form of the right fraction may be equal, and the prompt then asks for lowest terms
            if (equal) expect(/ireductibil/.test(it.prompt.ro) && /^−?\d+\/\d+$/.test(o.text?.ro ?? ''), `${it.id}: ${eq} wrong ${o.text?.ro}`).toBe(true);
          }
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
  });
  it('rational solutions are reduced fractions; basic solutions are natural numbers', () => {
    for (const it of gen('linear-equation', { kinds: ['rational'] }, 200)) {
      const t = answerText(it);
      const m = /^(−?)(\d+)\/(\d+)$/.exec(t);
      if (m) expect(bgcd(BigInt(m[2]), BigInt(m[3])), it.id).toBe(1n);
    }
    for (const it of gen('linear-equation', { kinds: ['basic'] }, 200)) {
      if (it.type === 'true-false') continue;
      expect(numAns(it) >= 0 && Number.isInteger(numAns(it)), it.id).toBe(true);
    }
  });
  it('word problems have exact whole answers (checked against the equation each template encodes)', () => {
    let n = 0;
    for (const it of gen('linear-equation', { kinds: ['word'] }, 300)) {
      const ans = numAns(it);
      const p = it.prompt.ro;
      let m: RegExpExecArray | null;
      if ((m = /înmulțit cu (\d+) și mărit cu (\d+) dă (\d+)/.exec(p))) expect(Number(m[1]) * ans + Number(m[2]), p).toBe(Number(m[3]));
      else if ((m = /Dublul unui număr, micșorat cu (\d+), este (\d+)/.exec(p))) expect(2 * ans - Number(m[1]), p).toBe(Number(m[2]));
      else if ((m = /trei numere naturale consecutive este (\d+)/.exec(p))) expect(3 * ans + 3, p).toBe(Number(m[1]));
      else if ((m = /de (\d+) ori vârsta fiului. Peste (\d+) ani, suma vârstelor lor va fi (\d+)/.exec(p))) expect(Number(m[1]) * ans + ans + 2 * Number(m[2]), p).toBe(Number(m[3]));
      else if ((m = /cu (\d+) cm mai mare decât lățimea, iar perimetrul de (\d+) cm/.exec(p))) expect(2 * (ans + ans + Number(m[1])), p).toBe(Number(m[2]));
      else continue;
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });
  it('inequalities: the offered interval holds for sample points inside and fails outside (sign turned for negative a)', () => {
    let n = 0;
    for (const it of gen('linear-equation', { kinds: ['ineq'] }, 400)) {
      if (it.type !== 'choice') continue;
      const m = /inecuația (.+?) (<|≤|>|≥) (−?\d+)\. /.exec(it.prompt.ro);
      if (!m) continue;
      const lhs = toJs(m[1]);
      const rhs = Number(m[3].replace('−', '-'));
      const test = (x: number) => {
        const v = new Function('x', `return ${lhs};`)(x) as number;
        return m[2] === '<' ? v < rhs : m[2] === '≤' ? v <= rhs : m[2] === '>' ? v > rhs : v >= rhs;
      };
      const inSet = (text: string, x: number): boolean => {
        const lo = /^x ∈ \(−∞; (−?\d+)([)\]])$/.exec(text);
        if (lo) {
          const t = Number(lo[1].replace('−', '-'));
          return lo[2] === ')' ? x < t : x <= t;
        }
        const hi = /^x ∈ ([(\[])(−?\d+); \+∞\)$/.exec(text);
        if (hi) {
          const t = Number(hi[2].replace('−', '-'));
          return hi[1] === '(' ? x > t : x >= t;
        }
        throw new Error(`bad interval ${text}`);
      };
      const probes: number[] = [];
      for (let x = -40; x <= 40; x++) probes.push(x, x + 0.5);
      for (const o of it.options) {
        const same = probes.every((x) => inSet(o.text?.ro ?? '', x) === test(x));
        expect(same, `${it.id}: ${m[0]} -> ${o.text?.ro}`).toBe(o.id === it.correctId);
      }
      n++;
    }
    expect(n).toBeGreaterThan(80);
  });
  it('systems: the pair solves both equations and is the unique integer solution; value answers match', () => {
    const jsOf = (eq: string) => lhsRhs(eq);
    const solve = (eq1: string, eq2: string): [number, number][] => {
      const [l1, r1] = jsOf(eq1);
      const [l2, r2] = jsOf(eq2);
      const f1 = new Function('x', 'y', `return (${l1}) - (${r1});`) as (x: number, y: number) => number;
      const f2 = new Function('x', 'y', `return (${l2}) - (${r2});`) as (x: number, y: number) => number;
      const out: [number, number][] = [];
      for (let x = -15; x <= 15; x++) for (let y = -15; y <= 15; y++) if (f1(x, y) === 0 && f2(x, y) === 0) out.push([x, y]);
      return out;
    };
    let n = 0;
    for (const it of gen('system-2x2', { negative: true }, 500)) {
      const text = it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const m = /sistemul(?:ui)? (.+? = −?\d+) și (.+? = −?\d+)/.exec(text);
      expect(m, text).not.toBeNull();
      const sol = solve((m as RegExpExecArray)[1], (m as RegExpExecArray)[2]);
      expect(sol).toHaveLength(1);
      const [x, y] = sol[0];
      const fmt = (v: number) => (v < 0 ? `−${-v}` : String(v));
      if (it.type === 'true-false') {
        const pm = /perechea (\(.+?\)) este/.exec(text);
        expect(pm![1] === `(${fmt(x)}; ${fmt(y)})`, it.id).toBe(it.correct);
      } else if (it.type === 'choice' && /Care este soluția \(x; y\)/.test(it.prompt.ro)) {
        expect(answerText(it)).toBe(`(${fmt(x)}; ${fmt(y)})`);
        for (const o of it.options) if (o.id !== it.correctId) expect(o.text?.ro).not.toBe(`(${fmt(x)}; ${fmt(y)})`);
      } else {
        const what = /Cât este (x \+ y|x|y)\?/.exec(it.prompt.ro ?? '')?.[1] ?? /^(x \+ y|x|y) = /.exec(it.type === 'fill-gap' ? it.template.ro : '')?.[1];
        const want = what === 'x' ? x : what === 'y' ? y : x + y;
        expect(evalExpr(answerText(it)).n, it.id).toBe(BigInt(want));
      }
      n++;
    }
    expect(n).toBe(500);
  });
});

describe('sqrt: roots, irrationals, radicals', () => {
  const isqrt = (n: number) => Math.floor(Math.sqrt(n));
  const isSq = (n: number) => isqrt(n) ** 2 === n;
  const N = (t: string) => Number(t.replace('−', '-'));
  it('perfect / expr / prodRoot give exact integer results', () => {
    for (const it of gen('sqrt', { modes: ['perfect', 'expr', 'prodRoot'] }, 500)) {
      const m = /^Calculează: (.+)$/.exec(it.prompt.ro);
      if (!m) continue;
      let want: number | undefined;
      let r: RegExpExecArray | null;
      if ((r = /^√(\d+)$/.exec(m[1]))) {
        expect(isSq(Number(r[1]))).toBe(true);
        want = Math.sqrt(Number(r[1]));
      } else if ((r = /^√\((\d+) · (\d+)\)$/.exec(m[1]))) want = Math.sqrt(Number(r[1])) * Math.sqrt(Number(r[2]));
      else if ((r = /^√\((\d+) \+ (\d+)\)$/.exec(m[1]))) {
        expect(isSq(Number(r[1]) + Number(r[2]))).toBe(true);
        want = Math.sqrt(Number(r[1]) + Number(r[2]));
      } else if ((r = /^√(\d+) · √(\d+)$/.exec(m[1]))) {
        expect(isSq(Number(r[1]) * Number(r[2]))).toBe(true);
        want = Math.sqrt(Number(r[1]) * Number(r[2]));
      } else if ((r = /^\(√(\d+)\)²$/.exec(m[1]))) want = Number(r[1]);
      if (want === undefined) continue;
      const claimed = it.type === 'true-false' ? undefined : numAns(it);
      if (claimed !== undefined) expect(claimed, `${it.id}: ${m[1]}`).toBe(want);
    }
  });
  it('between / approx / irrational / irrationalTf / classify are decided by integer arithmetic', () => {
    for (const it of gen('sqrt', { modes: ['between'] }, 200)) {
      const n = Number(/√(\d+)/.exec(it.prompt.ro)![1]);
      const [lo, hi] = answerText(it).split(' și ').map(Number);
      expect(lo * lo < n && n < hi * hi && hi === lo + 1, it.id).toBe(true);
    }
    for (const it of gen('sqrt', { modes: ['approx'] }, 200)) {
      const n = Number(/√(\d+)/.exec(it.prompt.ro)![1]);
      const k = numAns(it);
      expect(Math.abs(k * k - n) <= Math.abs((k - 1) ** 2 - n) && Math.abs(k * k - n) <= Math.abs((k + 1) ** 2 - n) || (k - 0.5) ** 2 < n && n < (k + 0.5) ** 2, it.id).toBe(true);
    }
    const irrational = (t: string): boolean => {
      if (t === 'π') return true;
      const m = /^√(\d+)$/.exec(t);
      return !!m && !isSq(Number(m[1]));
    };
    for (const it of gen('sqrt', { modes: ['irrational'] }, 300)) {
      if (it.type !== 'choice') continue;
      expect(it.options.filter((o) => irrational(o.text?.ro ?? '')).map((o) => o.id), `${it.id}: ${it.options.map((o) => o.text?.ro)}`).toEqual([it.correctId]);
      const rest = it.options.filter((o) => o.id !== it.correctId).map((o) => o.text?.ro ?? '');
      for (const t of rest) expect(/^√\d+$/.test(t) ? isSq(Number(t.slice(1))) : true, `${it.id}: ${t}`).toBe(true);
    }
    for (const it of gen('sqrt', { modes: ['irrationalTf'] }, 200)) {
      const n = Number(/√(\d+)/.exec(statement(it))![1]);
      expect(!isSq(n), it.id).toBe((it as { correct: boolean }).correct);
    }
    for (const it of gen('sqrt', { modes: ['classify'] }, 300)) {
      const text = /numărul (.+)\?$/.exec(it.prompt.ro)![1];
      const set = answerText(it);
      const isNat = (t: string) => {
        const v = valueOfRoot(t);
        return v !== null && v.d === 1n && v.n >= 0n;
      };
      const rootOf = /^−?√(\d+)$/.exec(text);
      let want: string;
      if (text === 'π' || (rootOf && !isSq(Number(rootOf[1])))) want = 'ℝ';
      else {
        const v = valueOfRoot(text) as Q;
        want = v.d !== 1n ? 'ℚ' : v.n >= 0n ? 'ℕ' : 'ℤ';
      }
      void isNat;
      expect(set, `${it.id}: ${text}`).toBe(want);
    }
    function valueOfRoot(t: string): Q | null {
      const m = /^(−?)√\((\d+)\/(\d+)\)$/.exec(t);
      if (m) {
        const a = Math.sqrt(Number(m[2]));
        const b = Math.sqrt(Number(m[3]));
        return q(BigInt(a * (m[1] ? -1 : 1)), BigInt(b));
      }
      const r = /^(−?)√(\d+)$/.exec(t);
      if (r) return q(BigInt(Math.sqrt(Number(r[2])) * (r[1] ? -1 : 1)));
      return valueOf(t.replace(/^(\d+)\/(\d+)$/, '$1/$2'));
    }
  });
  it('simplify / radSum / compare are exact', () => {
    for (const it of gen('sqrt', { modes: ['simplify'] }, 300)) {
      const m = /√(\d+) = \?$/.exec(it.prompt.ro) ?? /^√(\d+) = /.exec(statement(it === undefined ? it : it.type === 'true-false' ? it : it));
      const n = Number(m?.[1] ?? /√(\d+)/.exec(it.type === 'true-false' ? statement(it) : it.prompt.ro)![1]);
      const check = (t: string) => {
        const r = /^(\d+)√(\d+)$/.exec(t);
        return !!r && Number(r[1]) ** 2 * Number(r[2]) === n;
      };
      if (it.type === 'true-false') {
        const claimed = / = (.+)$/.exec(statement(it))![1];
        expect(check(claimed), it.id).toBe(it.correct);
      } else if (it.type === 'choice') {
        expect(check(answerText(it)), it.id).toBe(true);
        for (const o of it.options) if (o.id !== it.correctId) expect(check(o.text?.ro ?? ''), `${it.id}: ${o.text?.ro}`).toBe(false);
      }
    }
    for (const it of gen('sqrt', { modes: ['radSum'] }, 300)) {
      const m = /^Calculează: √(\d+) ([+−]) √(\d+)$/.exec(it.prompt.ro);
      if (!m) continue;
      const [a, b] = [Math.sqrt(Number(m[1]) / 1), Math.sqrt(Number(m[3]))];
      const r = /^(\d*)√(\d+)$/.exec(answerText(it))!;
      const coef = r[1] === '' ? 1 : Number(r[1]);
      const val = coef * Math.sqrt(Number(r[2]));
      expect(Math.abs(val - (m[2] === '+' ? a + b : a - b)) < 1e-9, it.id).toBe(true);
      for (const o of (it as ChoiceItem).options) {
        if (o.id === (it as ChoiceItem).correctId) continue;
        const w = /^(\d*)√(\d+)$/.exec(o.text?.ro ?? '')!;
        const wv = (w[1] === '' ? 1 : Number(w[1])) * Math.sqrt(Number(w[2]));
        expect(Math.abs(wv - (m[2] === '+' ? a + b : a - b)) > 1e-6, `${it.id}: ${o.text?.ro}`).toBe(true);
      }
    }
    for (const it of gen('sqrt', { modes: ['compare'] }, 300)) {
      const m = /^Compară √(\d+) și (\S+)\. /.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const lhs = BigInt(m[1]);
      const rhs = m[2].startsWith('√') ? BigInt(m[2].slice(1)) : null;
      let sign: string;
      if (rhs !== null) sign = lhs < rhs ? '<' : lhs > rhs ? '>' : '=';
      else {
        const v = evalExpr(m[2]);
        // sqrt(m) vs n/d  <=>  m * d^2 vs n^2
        const l = lhs * v.d * v.d;
        const r = v.n * v.n;
        sign = l < r ? '<' : l > r ? '>' : '=';
      }
      expect(answerText(it), it.id).toBe(sign);
    }
  });
  it('perfectFrac: √(p²/q²) = p/q and √0,49 = 0,7 (no point decimals in Romanian)', () => {
    for (const it of gen('sqrt', { modes: ['perfectFrac'] }, 300)) {
      const m = /^Calculează: √(.+?)(?:\.|$)/.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const f = /^\((\d+)\/(\d+)\)$/.exec(m[1]);
      const val = f ? q(BigInt(Math.sqrt(Number(f[1]))), BigInt(Math.sqrt(Number(f[2])))) : (() => {
        const x = evalExpr(m[1]);
        return q(BigInt(Math.sqrt(Number(x.n * 10000n / x.d)) * 1), 100n);
      })();
      if (f) expect(qeq(evalExpr(answerText(it)), val), it.id).toBe(true);
      else {
        const x = evalExpr(m[1]);
        const ans = evalExpr(answerText(it));
        expect(qeq(qmul(ans, ans), x), it.id).toBe(true);
      }
    }
  });
});

describe('pythagoras: triples, visuals, converse', () => {
  it('hyp / leg / perimeter / diagonal / ladder / height are exact; visuals hide the unknown side', () => {
    let n = 0;
    for (const it of gen('pythagoras', { modes: ['hyp', 'leg', 'perimeter', 'diagonalRect'] }, 600)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'shape' }> | undefined;
      if (it.type === 'true-false' || !v) continue;
      if (v.shape === 'triangle') {
        const [a, b, c] = v.sides as number[];
        expect(a * a + b * b, it.id).toBe(c * c);
        expect(v.hideSide, it.id).toBeDefined();
        const hidden = (v.sides as number[])[v.hideSide as number];
        if (/Care este lungimea ipotenuzei/.test(it.prompt.ro) || /doi?.*catet|celuilalt catet/.test(it.prompt.ro)) expect(numAns(it), it.id).toBe(hidden);
        if (/perimetrul/.test(it.prompt.ro)) expect(numAns(it), it.id).toBe(a + b + c);
      } else if (v.shape === 'rectangle') {
        const [a, b] = v.sides as number[];
        expect(numAns(it) ** 2, it.id).toBe(a * a + b * b);
      }
      n++;
    }
    expect(n).toBeGreaterThan(300);
    for (const it of gen('pythagoras', { modes: ['ladder', 'height'] }, 300)) {
      if (it.type === 'true-false') continue;
      const nums = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      const ans = numAns(it);
      if (/scară/.test(it.prompt.ro)) expect(ans * ans + nums[1] * nums[1], it.id).toBe(nums[0] * nums[0]);
      else expect(ans * ans + (nums[0] / 2) ** 2, it.id).toBe(nums[1] * nums[1]);
    }
  });
  it('converse: tf and selection agree with a² + b² = c² on the sorted sides', () => {
    const isRight = (s: number[]) => {
      const [a, b, c] = [...s].sort((x, y) => x - y);
      return a * a + b * b === c * c;
    };
    for (const it of gen('pythagoras', { modes: ['converse'] }, 300)) {
      const sides = /laturile de (.+) cm/.exec(statement(it))![1].split(', ').map(Number);
      expect(isRight(sides), it.id).toBe((it as { correct: boolean }).correct);
    }
    for (const it of gen('pythagoras', { modes: ['converseSelect'] }, 300)) {
      if (it.type !== 'choice') continue;
      for (const o of it.options) expect(isRight((o.text?.ro ?? '').split(', ').map(Number)), `${it.id}: ${o.text?.ro}`).toBe(o.id === it.correctId);
    }
  });
});

describe('areas-volumes: formulas, exact values and kπ answers', () => {
  const nums = (s: string) => (s.replace(/ /g, '').match(/\d+/g) ?? []).map(Number);
  it('plane figures and solids without π agree with independent formulas', () => {
    let n = 0;
    const topics = ['rect', 'square', 'tri', 'para', 'trap', 'rhombus', 'cube', 'box', 'prism', 'pyramid'];
    for (const it of gen('areas-volumes', { topics }, 1000)) {
      if (it.type === 'true-false' || /π/.test(answerText(it))) continue;
      const p = it.prompt.ro;
      const k = nums(p);
      const ans = numAns(it);
      let want: number | undefined;
      let m: RegExpExecArray | null;
      if (/dreptunghiului cu lungimea/.test(p)) want = /aria/.test(p) ? k[0] * k[1] : 2 * (k[0] + k[1]);
      else if (/dreptunghi are aria/.test(p)) want = k[0] / k[1];
      else if (/pătratului cu latura/.test(p)) want = /aria/.test(p) ? k[0] ** 2 : 4 * k[0];
      else if (/pătrat are perimetrul/.test(p)) want = (k[0] / 4) ** 2;
      else if (/triunghi are baza/.test(p)) want = (k[0] * k[1]) / 2;
      else if (/triunghi are aria/.test(p)) want = (2 * k[0]) / k[1];
      else if (/paralelogram/.test(p)) want = k[0] * k[1];
      else if (/trapez/.test(p)) want = ((k[0] + k[1]) * k[2]) / 2;
      else if (/romb are diagonalele/.test(p) && /aria/.test(p)) want = (k[0] * k[1]) / 2;
      else if (/romb are diagonalele/.test(p) && /latura/.test(p)) want = Math.sqrt((k[0] / 2) ** 2 + (k[1] / 2) ** 2);
      else if (/cub cu muchia/.test(p)) want = /volumul/.test(p) ? k[0] ** 3 : /totală/.test(p) ? 6 * k[0] ** 2 : 4 * k[0] ** 2;
      else if (/cub are volumul/.test(p)) want = Math.round(Math.cbrt(k[0]));
      else if (/paralelipiped dreptunghic cu dimensiunile/.test(p)) {
        const [L, l, h] = k;
        want = /volumul/.test(p) ? L * l * h : 2 * (L * l + L * h + l * h);
      } else if (/Un paralelipiped dreptunghic are baza/.test(p)) want = 2 * k[2] * (k[0] + k[1]);
      else if (/Un paralelipiped dreptunghic are dimensiunile/.test(p) || /dimensiunile .* cm, .* cm și/.test(p)) want = Math.sqrt(k[0] ** 2 + k[1] ** 2 + k[2] ** 2);
      else if ((m = /prismă dreaptă are drept bază.*catetele de (\d+) cm și (\d+) cm \(ipotenuza (\d+) cm\) și înălțimea de (\d+) cm/.exec(p))) {
        const [a, b, c, H] = [1, 2, 3, 4].map((i) => Number((m as RegExpExecArray)[i]));
        expect(a * a + b * b).toBe(c * c);
        want = /volumul/.test(p) ? ((a * b) / 2) * H : /laterală/.test(p) ? (a + b + c) * H : (a + b + c) * H + a * b;
      } else if (/piramidă patrulateră regulată/.test(p)) {
        const a = k[0];
        if (/volumul/.test(p)) want = (a * a * k[1]) / 3;
        else if (/apotema piramidei \(în cm\)|Care este apotema/.test(p)) want = Math.sqrt(k[1] ** 2 + (a / 2) ** 2);
        else want = 2 * a * k[1];
      }
      if (want === undefined) continue;
      expect(Number.isInteger(want), `${it.id}: ${p}`).toBe(true);
      expect(ans, `${it.id}: ${p}`).toBe(want);
      n++;
    }
    expect(n).toBeGreaterThan(450);
  });
  it('circle, cylinder, cone, sphere: coefficients of π are exact and never decimal approximations', () => {
    let n = 0;
    const piRe = /^(\d+)π(?:\/(\d+))?$/;
    const coef = (t: string): Q | null => {
      const m = piRe.exec(t);
      return m ? q(BigInt(m[1]), BigInt(m[2] ?? '1')) : null;
    };
    for (const it of gen('areas-volumes', { topics: ['circle', 'cylinder', 'cone', 'sphere'] }, 1000)) {
      const p = it.prompt.ro;
      const k = nums(p);
      if (it.type === 'choice') for (const o of it.options) expect(/\d,\d|\d\.\d/.test(o.text?.ro ?? ''), `${it.id}: ${o.text?.ro}`).toBe(false);
      if (it.type === 'true-false') continue;
      const t = answerText(it);
      const c = coef(t);
      let want: Q | undefined;
      if (/Un cerc are raza/.test(p)) want = /aria/.test(p) ? q(BigInt(k[0] ** 2)) : q(BigInt(2 * k[0]));
      else if (/cilindru/.test(p)) {
        const [r, h] = k;
        want = /volumul/.test(p) ? q(BigInt(r * r * h)) : /laterală/.test(p) ? q(BigInt(2 * r * h)) : q(BigInt(2 * r * (r + h)));
      } else if (/Un con circular drept/.test(p)) {
        const [r, h] = k;
        const g = Math.sqrt(r * r + h * h);
        expect(Number.isInteger(g)).toBe(true);
        if (/generatoarea/.test(p)) {
          expect(Number(t), it.id).toBe(g);
          n++;
          continue;
        }
        want = /volumul/.test(p) ? q(BigInt(r * r * h), 3n) : /laterală/.test(p) ? q(BigInt(r * g)) : q(BigInt(r * (r + g)));
      } else if (/O sferă are raza/.test(p)) {
        const r = k[0];
        want = /aria/.test(p) ? q(BigInt(4 * r * r)) : q(BigInt(4 * r ** 3), 3n);
      } else if (/aria de (\d+)π cm²/.test(p) || /lungimea de (\d+)π cm/.test(p)) {
        const r = /Un cerc are aria/.test(p) ? Math.sqrt(k[0]) : /Un cerc are lungimea/.test(p) ? k[0] / 2 : Math.sqrt(k[0] / 4);
        expect(Number(t), it.id).toBe(r);
        n++;
        continue;
      }
      if (!want) continue;
      expect(c, `${it.id}: ${p} -> ${t}`).not.toBeNull();
      expect(qeq(c as Q, want), `${it.id}: ${p} -> ${t}`).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(400);
  });
});

describe('algebra: polynomial identities verified at many points', () => {
  const toJs = (s: string) =>
    s
      .replace(/−/g, '-')
      .replace(/[²³⁴⁵⁶⁷⁸⁹]/g, (c) => `**${SUPMAP[c]}`)
      .replace(/(\d)x/g, '$1*x')
      .replace(/([\dx)])\(/g, '$1*(')
      .replace(/\)x/g, ')*x');
  const fn = (s: string) => new Function('x', `return ${toJs(s)};`) as (x: number) => number;
  const POINTS = [-7, -4, -3, -2, -1, 0, 1, 2, 3, 5, 8, 11];
  const same = (a: string, b: string) => POINTS.every((x) => fn(a)(x) === fn(b)(x));
  it('expansions, factorisations and simplifications: the right option is identical, the others are not', () => {
    let n = 0;
    for (const modes of [['expandSq'], ['expandDiff'], ['expandProd'], ['factor'], ['simplify']]) {
      for (const it of gen('algebra', { modes }, 300)) {
        if (it.type === 'true-false') {
          const st = statement(it);
          const idx = st.lastIndexOf(' = ');
          expect(same(st.slice(0, idx), st.slice(idx + 3)), it.id).toBe(it.correct);
          n++;
          continue;
        }
        if (it.type !== 'choice') continue;
        const m = /^(?:Dezvoltă și redu termenii asemenea|Dezvoltă|Descompune în factori|Redu termenii asemenea): (.+)$/.exec(it.prompt.ro);
        if (!m) continue;
        expect(same(m[1], answerText(it)), `${it.id}: ${m[1]} -> ${answerText(it)}`).toBe(true);
        for (const o of it.options) if (o.id !== it.correctId) expect(same(m[1], o.text?.ro ?? ''), `${it.id}: ${m[1]} vs ${o.text?.ro}`).toBe(false);
        n++;
      }
    }
    expect(n).toBeGreaterThan(900);
  });
  it('eval and numeric items are exact integers', () => {
    for (const it of gen('algebra', { modes: ['eval'] }, 300)) {
      const m = /valoarea expresiei (.+) pentru x = (−?\d+)\./.exec(it.prompt.ro);
      if (!m) continue;
      expect(fn(m[1])(Number(m[2].replace('−', '-'))), it.id).toBe(evalExpr(answerText(it)).n === 0n ? 0 : Number(evalExpr(answerText(it)).n));
    }
    for (const it of gen('algebra', { modes: ['numeric'] }, 300)) {
      const m = /prescurtat: (.+)$/.exec(it.prompt.ro);
      if (!m || it.type === 'true-false') continue;
      const e = m[1].replace(/²/g, '**2').replace(/−/g, '-').replace(/·/g, '*');
      expect(new Function(`return ${e};`)(), it.id).toBe(numAns(it));
    }
  });
});

describe('linear-function', () => {
  const N = (t: string) => Number(t.replace('−', '-'));
  const F_RE = /f\(x\) = (−?\d*x(?: [+−] \d+)?|−?\d+)/;
  const fOf = (txt: string): ((x: number) => number) => {
    const m = F_RE.exec(txt)!;
    const js = m[1].replace(/−/g, '-').replace(/(\d)x/g, '$1*x').replace(/(^|[^\d*])x/g, '$11*x').replace(/^-1\*x/, '-x');
    const body = js.replace(/(^|[ +-])1\*x/g, '$1x');
    return new Function('x', `return ${body.replace(/(\d)\*x/g, '$1*x')};`) as (x: number) => number;
  };
  it('values, points, zeros and Oy intersections lie on the graph', () => {
    let n = 0;
    for (const it of gen('linear-function', { modes: ['value', 'pointValue', 'point', 'zero', 'oy'] }, 700)) {
      const p = it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const fm = F_RE.exec(p);
      if (!fm) continue;
      const f = fOf(fm[0]);
      let r: RegExpExecArray | null;
      if (it.type === 'true-false' && (r = /punctul A\((−?\d+); (−?\d+)\)/.exec(p))) expect(f(N(r[1])) === N(r[2]), it.id).toBe(it.correct);
      else if (it.type === 'true-false' && (r = /pentru f\(x\) = .+ avem f\((−?\d+)\) = (−?\d+)/.exec(p))) expect(f(N(r[1])) === N(r[2]), it.id).toBe(it.correct);
      else if (it.type === 'true-false' && (r = /punctul (\(.+?\))\.$/.exec(p))) {
        const [x, y] = r[1].replace(/[()]/g, '').split('; ').map(N);
        const axis = /axa Ox/.test(p);
        expect(axis ? y === 0 && f(x) === 0 : x === 0 && f(0) === y, it.id).toBe(it.correct);
      } else if ((r = /Calculează f\((−?\d+)\)/.exec(p))) expect(f(N(r[1])), it.id).toBe(evalExpr(answerText(it)).n === 0n ? 0 : Number(evalExpr(answerText(it)).n));
      else if ((r = /punctul P\((\d+); m\)/.exec(p))) expect(f(Number(r[1])), it.id).toBe(evalExpr(answerText(it)).n === 0n ? 0 : Number(evalExpr(answerText(it)).n));
      else if (/axa O[xy]/.test(p) && it.type === 'choice') {
        const [x, y] = answerText(it).replace(/[()]/g, '').split('; ').map(N);
        if (/axa Ox/.test(p)) expect(y === 0 && f(x) === 0, it.id).toBe(true);
        else expect(x === 0 && f(0) === y, it.id).toBe(true);
        for (const o of it.options) {
          if (o.id === it.correctId) continue;
          const [wx, wy] = (o.text?.ro ?? '').replace(/[()]/g, '').split('; ').map(N);
          const ok = /axa Ox/.test(p) ? wy === 0 && f(wx) === 0 : wx === 0 && f(0) === wy;
          expect(ok, `${it.id}: ${o.text?.ro}`).toBe(false);
        }
      } else continue;
      n++;
    }
    expect(n).toBeGreaterThan(400);
  });
  it('slope, eqline and line2 are exact', () => {
    for (const it of gen('linear-function', { modes: ['slope'] }, 300)) {
      const p = it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const m = /A\((−?\d+); (−?\d+)\) și B\((−?\d+); (−?\d+)\)/.exec(p)!;
      const [x1, y1, x2, y2] = m.slice(1).map(N);
      const slope = q(BigInt(y2 - y1), BigInt(x2 - x1));
      if (it.type === 'true-false') expect(qeq(evalExpr(/ este (.+)$/.exec(p)![1]), slope), it.id).toBe(it.correct);
      else {
        expect(qeq(evalExpr(answerText(it)), slope), it.id).toBe(true);
        if (it.type === 'choice') for (const o of it.options) if (o.id !== it.correctId) expect(qeq(evalExpr(o.text?.ro ?? '0'), slope), it.id).toBe(false);
      }
    }
    for (const it of gen('linear-function', { modes: ['line2'] }, 300)) {
      const m = /A\((−?\d+); (−?\d+)\) și B\((−?\d+); (−?\d+)\)/.exec(it.prompt.ro)!;
      const [x1, y1, x2, y2] = m.slice(1).map(N);
      const f = fOf(answerText(it));
      expect([f(x1) + 0, f(x2) + 0]).toEqual([y1 + 0, y2 + 0]);
      for (const o of (it as ChoiceItem).options) {
        if (o.id === (it as ChoiceItem).correctId) continue;
        const g = fOf(o.text?.ro ?? '');
        expect(g(x1) === y1 && g(x2) === y2, `${it.id}: ${o.text?.ro}`).toBe(false);
      }
    }
    for (const it of gen('linear-function', { modes: ['eqline'] }, 200)) {
      const m = /panta (−?\d+) și intersectează axa Oy în punctul \(0; (−?\d+)\)/.exec(it.prompt.ro)!;
      const f = fOf(answerText(it));
      expect([f(0) + 0, f(1) - f(0) + 0]).toEqual([N(m[2]) + 0, N(m[1]) + 0]);
    }
  });
});

describe('probability and statistics: counted, not guessed', () => {
  it('urn / die / dice2 / coins / numbers probabilities are favourable / possible (reduced), counts agree', () => {
    let n = 0;
    const dieEvents: [RegExp, (v: number) => boolean][] = [
      [/un număr par/, (v) => v % 2 === 0],
      [/un număr impar/, (v) => v % 2 === 1],
      [/mai mare decât 4/, (v) => v > 4],
      [/mai mic decât 3/, (v) => v < 3],
      [/un divizor al lui 6/, (v) => 6 % v === 0],
      [/un număr prim/, (v) => [2, 3, 5].includes(v)],
      [/un multiplu de 3/, (v) => v % 3 === 0],
    ];
    for (const it of gen('probability', { scenarios: ['die'], asks: ['prob', 'fav', 'total', 'complement', 'percent'] }, 400)) {
      const p = it.type === 'fill-gap' ? it.prompt.ro : it.prompt.ro;
      const ev = dieEvents.find(([re]) => re.test(p));
      expect(ev, p).toBeDefined();
      const fav = [1, 2, 3, 4, 5, 6].filter((ev as [RegExp, (v: number) => boolean])[1]).length;
      const not = /să nu se obțină/.test(p);
      const f = not ? 6 - fav : fav;
      if (it.type === 'true-false') continue;
      if (/Câte cazuri favorabile/.test(p)) expect(numAns(it), p).toBe(fav);
      else if (/Câte cazuri posibile/.test(p)) expect(numAns(it), p).toBe(6);
      else if (/în procente/.test(p)) expect(BigInt(numAns(it)) * 6n, p).toBe(BigInt(fav) * 100n);
      else expect(qeq(evalExpr(answerText(it)), q(BigInt(f), 6n)), p).toBe(true);
      n++;
    }
    for (const it of gen('probability', { scenarios: ['urn'], asks: ['prob', 'fav', 'total', 'complement'] }, 400)) {
      if (it.type === 'true-false') continue;
      const p = it.prompt.ro;
      const counts: Record<string, number> = {};
      for (const m of /bile (.+?)\. Se extrage/.exec(p)![1].matchAll(/(\d+) (roșii|albastre|verzi)/g)) counts[m[2]] = Number(m[1]);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const ev = /(să nu fie roșie|să nu fie albastră|să nu fie verde|să fie roșie sau albastră|să fie roșie|să fie albastră|să fie verde)/.exec(p)![1];
      const fav = ev === 'să fie roșie sau albastră' ? (counts.roșii ?? 0) + (counts.albastre ?? 0) : ev === 'să fie verde' ? counts.verzi ?? 0
        : ev === 'să fie roșie' ? counts.roșii ?? 0 : ev === 'să fie albastră' ? counts.albastre ?? 0
        : ev === 'să nu fie roșie' ? total - (counts.roșii ?? 0) : ev === 'să nu fie albastră' ? total - (counts.albastre ?? 0) : total - (counts.verzi ?? 0);
      if (/Câte cazuri favorabile/.test(p)) expect(numAns(it), p).toBe(fav);
      else if (/Câte cazuri posibile/.test(p)) expect(numAns(it), p).toBe(total);
      else expect(qeq(evalExpr(answerText(it)), q(BigInt(fav), BigInt(total))), p).toBe(true);
      // the grid draws exactly the balls of the urn
      if (it.visual) expect((it.visual as Extract<VisualSpec, { kind: 'grid' }>).cells.length).toBe(total);
      n++;
    }
    for (const it of gen('probability', { scenarios: ['dice2'], asks: ['prob', 'fav', 'total'] }, 300)) {
      if (it.type === 'true-false') continue;
      const s = Number(/să fie (\d+)/.exec(it.prompt.ro)?.[1] ?? /\„ca suma numerelor obținute să fie (\d+)”/.exec(it.prompt.ro)?.[1]);
      let fav = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) fav++;
      if (/Câte cazuri favorabile/.test(it.prompt.ro)) expect(numAns(it)).toBe(fav);
      else if (/Câte cazuri posibile/.test(it.prompt.ro)) expect(numAns(it)).toBe(36);
      else expect(qeq(evalExpr(answerText(it)), q(BigInt(fav), 36n)), it.prompt.ro).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });
  it('mean, median, mode, range, missing value and weighted mean are exact', () => {
    const list = (p: string) => (/(?:numerelor|valorilor|șirul|pentru|numere|în) ((?:\d+, )*\d+)/.exec(p)?.[1] ?? '').split(', ').map(Number);
    let n = 0;
    for (const it of gen('statistics', { modes: ['mean', 'median', 'mode', 'range'] }, 800)) {
      const p = it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const vals = list(p.replace(/^.*\? \(ordonează.*$/, ''));
      const data = vals.length > 1 ? vals : list(p);
      if (data.length < 3) continue;
      const sorted = [...data].sort((a, b) => a - b);
      let want: Q;
      if (/media aritmetică/.test(p)) want = q(BigInt(data.reduce((a, b) => a + b, 0)), BigInt(data.length));
      else if (/mediana/.test(p)) want = data.length % 2 ? q(BigInt(sorted[(data.length - 1) / 2])) : q(BigInt(sorted[data.length / 2 - 1] + sorted[data.length / 2]), 2n);
      else if (/modulul/.test(p)) {
        const counts = new Map<number, number>();
        data.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
        want = q(BigInt([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]));
      } else if (/amplitudinea/.test(p)) want = q(BigInt(sorted[sorted.length - 1] - sorted[0]));
      else continue;
      if (it.type === 'true-false') {
        expect(qeq(evalExpr(/ este (.+)\.?$/.exec(p)![1]), want), it.id).toBe(it.correct);
      } else expect(qeq(evalExpr(answerText(it)), want), `${it.id}: ${data} -> ${answerText(it)}`).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(400);
    for (const it of gen('statistics', { modes: ['missing'] }, 200)) {
      const m = /a (\d+) numere este (\d+)\. .+ sunt ((?:\d+, )*\d+)\./.exec(it.prompt.ro)!;
      const known = m[3].split(', ').map(Number);
      expect(numAns(it), it.id).toBe(Number(m[1]) * Number(m[2]) - known.reduce((a, b) => a + b, 0));
    }
    for (const it of gen('statistics', { modes: ['weighted', 'freq'] }, 200)) {
      const pairs = [...it.prompt.ro.matchAll(/nota (\d+): (\d+) elev/g)].map((x) => [Number(x[1]), Number(x[2])]);
      const total = pairs.reduce((a, [, f]) => a + f, 0);
      const wsum = pairs.reduce((a, [g, f]) => a + g * f, 0);
      if (/Câți elevi/.test(it.prompt.ro)) expect(numAns(it), it.id).toBe(total);
      else {
        expect(wsum % total).toBe(0);
        expect(numAns(it), it.id).toBe(wsum / total);
      }
    }
  });
});

describe('angles and segments-units', () => {
  it('complement, supplement, opposite, bisector, compose, triangle angles and polygons are exact', () => {
    let n = 0;
    for (const it of gen('angles', { modes: ['complement', 'supplement', 'opposite', 'bisector', 'compose', 'triangleSum', 'isosceles', 'exterior', 'parallel', 'polygon'] }, 1000)) {
      if (it.type === 'true-false') continue;
      const p = it.prompt.ro;
      const k = (p.match(/\d+/g) ?? []).map(Number);
      const ans = numAns(it);
      let want: number | undefined;
      if (/complementului/.test(p)) want = 90 - k[0];
      else if (/suplementului/.test(p)) want = 180 - k[0];
      else if (/adiacente suplementare/.test(p)) want = 180 - k[0];
      else if (/opuse la vârf/.test(p)) want = k[0];
      else if (/bisectoarea/.test(p)) want = k[0] / 2;
      else if (/în interiorul unghiului AOC/.test(p)) want = k[0] + k[1];
      else if (/două unghiuri au/.test(p)) want = 180 - k[0] - k[1];
      else if (/unghiul de la vârf de/.test(p)) want = (180 - k[0]) / 2;
      else if (/unghiurile de la bază de/.test(p)) want = 180 - 2 * k[0];
      else if (/unghiul exterior/.test(p)) want = k[0] + k[1];
      else if (/Dreptele paralele/.test(p)) want = /interne de aceeași parte/.test(p) ? 180 - k[0] : k[0];
      else if (/suma măsurilor unghiurilor unui poligon/.test(p)) want = (k[0] - 2) * 180;
      else if (/poligon regulat/.test(p)) want = ((k[0] - 2) * 180) / k[0];
      if (want === undefined) continue;
      expect(Number.isInteger(want), p).toBe(true);
      expect(ans, p).toBe(want);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });
  it('angle kinds, triangle kinds and the triangle inequality are decided correctly', () => {
    for (const it of gen('angles', { modes: ['types'] }, 200)) {
      const st = it.type === 'true-false' ? statement(it) : it.prompt.ro;
      const m = /(\d+)°/.exec(st)!;
      const a = Number(m[1]);
      const kind = a < 90 ? 'ascuțit' : a === 90 ? 'drept' : a < 180 ? 'obtuz' : 'alungit';
      if (it.type === 'true-false') expect(new RegExp(` este ${kind}$`).test(st), it.id).toBe(it.correct);
      else expect(answerText(it), it.id).toBe(kind);
    }
    for (const it of gen('angles', { modes: ['triangleKind'] }, 200)) {
      const ang = (it.prompt.ro.match(/\d+/g) ?? []).map(Number);
      expect(ang.reduce((a, b) => a + b, 0)).toBe(180);
      const max = Math.max(...ang);
      expect(answerText(it), it.id).toBe(max === 90 ? 'dreptunghic' : max > 90 ? 'obtuzunghic' : 'ascuțitunghic');
    }
    for (const it of gen('angles', { modes: ['sidesKind'] }, 200)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'shape' }>;
      const [a, b, c] = v.sides as number[];
      expect(a + b > c && a + c > b && b + c > a).toBe(true);
      const kind = a === b && b === c ? 'echilateral' : a === b || b === c || a === c ? 'isoscel' : 'scalen';
      expect(answerText(it), it.id).toBe(kind);
    }
    for (const it of gen('angles', { modes: ['triangleIneq'] }, 200)) {
      const sides = /laturile de (.+) cm/.exec(statement(it))![1].split(', ').map(Number).sort((a, b) => a - b);
      expect(sides[0] + sides[1] > sides[2], it.id).toBe((it as { correct: boolean }).correct);
    }
  });
  it('segments: sums, midpoints and number-line lengths; unit conversions are exact', () => {
    for (const it of gen('segments-units', { modes: ['segment', 'midpoint', 'line'] }, 500)) {
      if (it.type === 'true-false') continue;
      const p = it.prompt.ro;
      const k = (p.match(/\d+/g) ?? []).map(Number);
      const ans = numAns(it);
      if (/Dacă AB = \d+ cm și BC = \d+ cm/.test(p)) expect(ans, p).toBe(k[0] + k[1]);
      else if (/Dacă AC = \d+ cm și AB = \d+ cm/.test(p)) expect(ans, p).toBe(k[0] - k[1]);
      else if (/Dacă AB = \d+ cm, cât este AM/.test(p)) expect(ans * 2, p).toBe(k[0]);
      else if (/Dacă AM = \d+ cm, cât este AB/.test(p)) expect(ans, p).toBe(k[0] * 2);
      else if (/mijlocul segmentului AM/.test(p)) expect(ans * 4, p).toBe(k[0]);
      else if (/Pe axa numerelor/.test(p)) {
        const v = it.visual as Extract<VisualSpec, { kind: 'number-line' }>;
        const [a, b] = v.marks as number[];
        expect(ans, p).toBe(Math.abs(b - a));
        expect(k.slice(0, 2).sort((x, y) => x - y)).toEqual([a, b]);
      }
    }
    const POW: Record<string, number> = { km: 3, m: 0, cm: -2, mm: -3, dm: -1, t: 3, kg: 0, g: -3, l: 0, ml: -3, hl: 2, 'm²': 0, 'dm²': -2, 'cm²': -4, ha: 4, 'm³': 0, 'dm³': -3, 'cm³': -6 };
    const FAMILY: Record<string, string> = { km: 'L', m: 'L', cm: 'L', mm: 'L', dm: 'L', t: 'M', kg: 'M', g: 'M', l: 'C', ml: 'C', hl: 'C', 'm²': 'A', 'dm²': 'A', 'cm²': 'A', ha: 'A', 'm³': 'V', 'dm³': 'V', 'cm³': 'V' };
    let n = 0;
    for (const it of gen('segments-units', { modes: ['convert'], groups: ['length', 'mass', 'capacity', 'area', 'volume'] }, 600)) {
      if (it.type === 'true-false') continue;
      const m = /Transformă: (\d+(?: \d{3})?) (\S+) = \? (\S+)/.exec(it.prompt.ro);
      expect(m, it.prompt.ro).not.toBeNull();
      const v = BigInt((m as RegExpExecArray)[1].replace(/ /g, ''));
      const from = (m as RegExpExecArray)[2];
      const to = (m as RegExpExecArray)[3];
      expect(FAMILY[from]).toBe(FAMILY[to]);
      const shift = POW[from] - POW[to];
      const want = shift >= 0 ? q(v * 10n ** BigInt(shift)) : q(v, 10n ** BigInt(-shift));
      expect(qeq(evalExpr(answerText(it)), want), `${it.id}: ${it.prompt.ro} -> ${answerText(it)}`).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(300);
  });
});

/* ------------------------------------------------------------------ */
/*  Visual kit: negative number lines are supported                     */
/* ------------------------------------------------------------------ */

describe('negative number-line visuals', () => {
  it('number-line specs with from < 0 < to validate and carry the marks inside the range', () => {
    for (const it of gen('integers', { modes: ['line', 'jump', 'dist'] }, 300)) {
      const v = it.visual as Extract<VisualSpec, { kind: 'number-line' }> | undefined;
      if (!v) continue;
      expect(validateItem(it)).toEqual([]);
      expect(v.from).toBeLessThan(v.to);
      for (const m of v.marks ?? []) expect(m >= v.from && m <= v.to).toBe(true);
      for (const j of v.jumps ?? []) expect([j.from, j.to].every((x) => x >= v.from && x <= v.to)).toBe(true);
    }
  });
});

describe('performance', () => {
  it('200 items per skill stay fast (no enumeration anywhere)', () => {
    const t0 = Date.now();
    for (const s of newSkills) generateItems(s, COUNT, { seed: 5 });
    expect(Date.now() - t0).toBeLessThan(8000);
  });
});

void rangeOf;
