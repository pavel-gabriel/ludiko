import { describe, it, expect } from 'vitest';
import { getAllSkills, getExplanation, getSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { validateItem, validateSkillGraph } from '../src/engine/content/validate';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, listGenerators, mulberry32 } from '../src/engine/items/generators';
import { addCarriesAny, sampleAddPair, sampleSubPair, subBorrowsAny } from '../src/engine/items/generators/arithmetic';
import { roundTo } from '../src/engine/items/generators/rounding';
import { enNumber, roNumber } from '../src/engine/items/generators/numberWords';
import { fmt, unfmt } from '../src/engine/items/generators/numfmt';
import type { Item, ItemResponse, Skill } from '../src/engine/types';

const SEED = 20260611;
const COUNT = 200;

import grade3File from '../content/skills/mat/grade3.json';
import grade4File from '../content/skills/mat/grade4.json';
/* Scope: the numbers & operations skills from grade3.json / grade4.json (measures have their own tests) */
const OWN_IDS = new Set([...(grade3File as Skill[]), ...(grade4File as Skill[])].map((s) => s.id));
const newSkills: Skill[] = getSkillsBySubject('mat').filter((s) => OWN_IDS.has(s.id));
const byId = (id: string): Skill => {
  const s = getSkill(id);
  if (!s) throw new Error(`missing skill ${id}`);
  return s;
};
const sourcesOf = (s: Skill) => s.itemSources.flatMap((x) => ('generator' in x ? [x] : []));
const ids = (list: Skill[]) => list.map((s) => s.id);

const plain = (s: string) => s.replace(/ /g, '');

function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer':
    case 'hotspot':
      return { type: item.type, selectedId: item.correctId };
    case 'true-false':
      return { type: 'true-false', value: item.correct };
    case 'number-input':
      return { type: 'number-input', value: item.correct };
    case 'fill-gap':
      return { type: 'fill-gap', value: item.correct };
    case 'order':
      return { type: 'order', order: item.correctOrder };
    default:
      throw new Error(`unexpected item type ${item.type}`);
  }
}

/** Numeric answer of number-input / fill-gap / choice items (undefined for others) */
function answerOf(item: Item): number | undefined {
  if (item.type === 'number-input') return item.correct;
  if (item.type === 'fill-gap') return Number(item.correct);
  if (item.type === 'choice') {
    const t = item.options.find((o) => o.id === item.correctId)?.text?.ro;
    return t !== undefined && /^[\d  ]+$/.test(t) ? unfmt(t) : undefined;
  }
  return undefined;
}

/** The text of an item with the gap shown as "{{gap}}" and numbers without grouping spaces */
const textOf = (item: Item): string => plain(item.type === 'fill-gap' ? item.template.ro : item.prompt.ro);

/* ------------------------------------------------------------------ */
/*  Romanian number words                                              */
/* ------------------------------------------------------------------ */

describe('roNumber / enNumber', () => {
  const table: [number, string][] = [
    [0, 'zero'], [1, 'unu'], [2, 'doi'], [9, 'nouă'], [10, 'zece'], [11, 'unsprezece'], [12, 'doisprezece'],
    [16, 'șaisprezece'], [20, 'douăzeci'], [21, 'douăzeci și unu'], [22, 'douăzeci și doi'], [47, 'patruzeci și șapte'],
    [100, 'o sută'], [101, 'o sută unu'], [110, 'o sută zece'], [200, 'două sute'], [305, 'trei sute cinci'],
    [345, 'trei sute patruzeci și cinci'], [999, 'nouă sute nouăzeci și nouă'],
    [1000, 'o mie'], [1001, 'o mie unu'], [1002, 'o mie doi'], [1100, 'o mie o sută'], [1999, 'o mie nouă sute nouăzeci și nouă'],
    [2000, 'două mii'], [2005, 'două mii cinci'], [3482, 'trei mii patru sute optzeci și doi'], [4305, 'patru mii trei sute cinci'],
    [10000, 'zece mii'], [11000, 'unsprezece mii'], [12000, 'douăsprezece mii'], [15000, 'cincisprezece mii'],
    [19000, 'nouăsprezece mii'], [20000, 'douăzeci de mii'], [21000, 'douăzeci și una de mii'],
    [22000, 'douăzeci și două de mii'], [35000, 'treizeci și cinci de mii'], [99000, 'nouăzeci și nouă de mii'],
    [45302, 'patruzeci și cinci de mii trei sute doi'],
    [100000, 'o sută de mii'], [101000, 'o sută una mii'], [102000, 'o sută două mii'], [112000, 'o sută douăsprezece mii'],
    [120000, 'o sută douăzeci de mii'], [200000, 'două sute de mii'], [250000, 'două sute cincizeci de mii'],
    [305040, 'trei sute cinci mii patruzeci'], [521000, 'cinci sute douăzeci și una de mii'],
    [999999, 'nouă sute nouăzeci și nouă de mii nouă sute nouăzeci și nouă'],
    [1000000, 'un milion'],
  ];
  for (const [n, words] of table) {
    it(`${n} -> ${words}`, () => expect(roNumber(n)).toBe(words));
  }

  it('is injective, clean and in range for a wide sample', () => {
    const seen = new Map<string, number>();
    const check = (n: number) => {
      const w = roNumber(n);
      expect(w, String(n)).toMatch(/^[a-zăâîșț]+( [a-zăâîșț]+)*$/);
      expect(seen.get(w), `${n} vs ${seen.get(w)}`).toBeUndefined();
      seen.set(w, n);
    };
    for (let n = 0; n <= 3000; n++) check(n);
    const rng = mulberry32(5);
    for (let k = 0; k < 20000; k++) {
      const n = 3001 + Math.floor(rng() * 996999);
      if (!seen.has(roNumber(n))) check(n);
    }
    check(1000000);
  });

  it('applies the "de" rule before "mii" exactly for counts 20-99 and full hundreds', () => {
    for (let t = 2; t < 1000; t++) {
      const w = roNumber(t * 1000);
      const de = t % 100 === 0 || t % 100 >= 20;
      expect(/ de mii$/.test(w), `${t * 1000}: ${w}`).toBe(de);
    }
  });

  it('rejects out-of-range values and spells English', () => {
    expect(() => roNumber(1000001)).toThrow();
    expect(() => roNumber(-1)).toThrow();
    expect(enNumber(2345)).toBe('two thousand three hundred forty-five');
    expect(enNumber(1000000)).toBe('one million');
    expect(enNumber(0)).toBe('zero');
  });

  it('fmt groups from 10 000 up and unfmt reverses it', () => {
    expect(fmt(999)).toBe('999');
    expect(fmt(4567)).toBe('4567');
    expect(fmt(45302)).toBe('45 302');
    expect(fmt(1000000)).toBe('1 000 000');
    expect(unfmt(fmt(1000000))).toBe(1000000);
  });
});

/* ------------------------------------------------------------------ */
/*  Multi-digit addition / subtraction constraints                     */
/* ------------------------------------------------------------------ */

/** Independent column-by-column simulation (not the helpers under test) */
function columns(a: number, b: number, op: '+' | '-'): { carried: boolean } {
  const x = String(a).split('').reverse().map(Number);
  const y = String(b).split('').reverse().map(Number);
  let carry = 0;
  let any = false;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (op === '+') {
      const s = p + q + carry;
      carry = s >= 10 ? 1 : 0;
    } else {
      const s = p - q - carry;
      carry = s < 0 ? 1 : 0;
    }
    if (carry) any = true;
  }
  return { carried: any };
}

describe('multi-digit add/sub sampling', () => {
  for (const max of [1000, 10000, 1000000]) {
    for (const d of [1, 3, 5] as const) {
      for (const flag of [true, false, undefined]) {
        it(`addition max=${max} d=${d} carry=${String(flag)}`, () => {
          const rng = mulberry32(max + d);
          for (let k = 0; k < 600; k++) {
            const { a, b } = sampleAddPair(rng, max, d, flag);
            expect(a).toBeGreaterThanOrEqual(1);
            expect(b).toBeGreaterThanOrEqual(1);
            expect(a + b).toBeLessThanOrEqual(max);
            const carried = columns(a, b, '+').carried;
            expect(addCarriesAny(a, b)).toBe(carried);
            if (flag !== undefined) expect(carried, `${a} + ${b}`).toBe(flag);
          }
        });
        it(`subtraction max=${max} d=${d} borrow=${String(flag)}`, () => {
          const rng = mulberry32(max * 3 + d);
          for (let k = 0; k < 600; k++) {
            const { a, b } = sampleSubPair(rng, max, d, flag);
            expect(b).toBeGreaterThanOrEqual(1);
            expect(a).toBeGreaterThan(b);
            expect(a).toBeLessThanOrEqual(max);
            const borrowed = columns(a, b, '-').carried;
            expect(subBorrowsAny(a, b)).toBe(borrowed);
            if (flag !== undefined) expect(borrowed, `${a} - ${b}`).toBe(flag);
          }
        });
      }
    }
  }

  it('uses the full width of the range (multi-digit operands appear)', () => {
    const rng = mulberry32(9);
    let big = 0;
    for (let k = 0; k < 400; k++) if (sampleAddPair(rng, 1000000, 5, undefined).a >= 100000) big++;
    expect(big).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------------ */
/*  The new skills                                                     */
/* ------------------------------------------------------------------ */

describe('grade III-IV content', () => {
  const grade3 = newSkills.filter((s) => s.grade === 3);
  const grade4 = newSkills.filter((s) => s.grade === 4);

  it('has 10-16 skills per grade, all registered generators', () => {
    expect(grade3.length).toBeGreaterThanOrEqual(10);
    expect(grade3.length).toBeLessThanOrEqual(16);
    expect(grade4.length).toBeGreaterThanOrEqual(10);
    expect(grade4.length).toBeLessThanOrEqual(16);
    const names = new Set(listGenerators());
    for (const s of newSkills) for (const src of sourcesOf(s)) expect(names.has(src.generator), `${s.id}: ${src.generator}`).toBe(true);
    for (const g of ['multiplication', 'division', 'equation', 'order-of-operations', 'rounding', 'number-reading']) {
      expect(names.has(g), g).toBe(true);
    }
  });

  it('the skill graph (all grades) is valid and new prerequisites point into 0-II or the new files', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    const newIds = new Set(ids(newSkills));
    for (const s of newSkills) {
      expect(s.prerequisites.length, s.id).toBeGreaterThan(0);
      for (const p of s.prerequisites) {
        const pre = getSkill(p)!;
        expect(pre, `${s.id} -> ${p}`).toBeDefined();
        expect(newIds.has(p) || pre.grade <= 2, `${s.id} -> ${p}`).toBe(true);
      }
    }
    // the new grade III skills link into the existing grade II graph
    const linked = new Set(grade3.flatMap((s) => s.prerequisites));
    for (const id of ['mat.add.carry.100', 'mat.sub.borrow.100', 'mat.placevalue.100']) expect(linked.has(id), id).toBe(true);
  });

  it('follows the content policy: own/OWN/Ludiko, programa MAT-III-IV-2014 "to verify", ro+en titles', () => {
    for (const s of newSkills) {
      expect(s.provenance).toMatchObject({ source: 'own', licence: 'OWN', author: 'Ludiko' });
      expect(s.provenance.notes, s.id).toMatch(/to verify/);
      expect(s.competences.every((c) => c.programa === 'MAT-III-IV-2014')).toBe(true);
      expect(s.title.ro && s.title.en).toBeTruthy();
    }
  });

  it('every new skill has an explanation of 3-4 frames, each with a visual and ro+en text', () => {
    for (const s of newSkills) {
      expect(s.explanations.length, s.id).toBeGreaterThanOrEqual(1);
      const e = getExplanation(s.explanations[0]);
      expect(e, s.id).toBeDefined();
      expect(e!.skillId).toBe(s.id);
      expect(e!.reviewStatus).toBe('beta');
      expect(e!.provenance).toMatchObject({ source: 'ai-draft', licence: 'OWN' });
      expect(e!.frames.length).toBeGreaterThanOrEqual(3);
      expect(e!.frames.length).toBeLessThanOrEqual(4);
      for (const f of e!.frames) {
        expect(f.visual, s.id).toBeDefined();
        expect(f.text.ro && f.text.en).toBeTruthy();
      }
    }
  });
});

describe('generators over every new skill', () => {
  for (const skill of newSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it('produces 200 generated items that all pass validateItem', () => {
        expect(items).toHaveLength(COUNT);
        for (const it of items) {
          expect(it.id.startsWith('gen.')).toBe(true);
          expect(validateItem(it), it.id).toEqual([]);
          expect(it.prompt.en, it.id).toBeTruthy();
          expect(it.explanationId).toBe(skill.explanations[0]);
        }
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
      });

      it('the correct response checks out and no other choice does', () => {
        for (const it of items) {
          expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
          if (it.type === 'choice') {
            for (const o of it.options) if (o.id !== it.correctId) expect(checkResponse(it, { type: 'choice', selectedId: o.id }), it.id).toBe(false);
          }
          if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct })).toBe(false);
        }
      });

      it('distractors are unique, and the right answer is never duplicated', () => {
        for (const it of items) {
          if (it.type === 'choice') {
            const texts = it.options.map((o) => JSON.stringify(o.text));
            expect(new Set(texts).size, it.id).toBe(texts.length);
            expect(it.options.length, it.id).toBeGreaterThanOrEqual(/prima în/.test(it.prompt.ro) ? 2 : 3);
          }
          if (it.type === 'fill-gap' && it.options) {
            expect(new Set(it.options).size, it.id).toBe(it.options.length);
            expect(it.options).toContain(it.correct);
          }
          if (it.type === 'order') expect(new Set(it.cards.map((c) => c.text?.ro)).size).toBe(it.cards.length);
        }
      });

      it('is deterministic per seed and mixes several item types', () => {
        expect(JSON.stringify(generateItems(skill, COUNT, { seed: SEED }))).toBe(JSON.stringify(items));
        const other = generateItems(skill, 40, { seed: SEED + 1 });
        expect(JSON.stringify(other.map((i) => i.prompt))).not.toBe(JSON.stringify(items.slice(0, 40).map((i) => i.prompt)));
        expect(new Set(items.map((i) => i.type)).size).toBeGreaterThanOrEqual(2);
      });

      it('works at every difficulty', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          for (const it of generateItems(skill, 40, { seed: d, difficulty: d })) {
            expect(validateItem(it), it.id).toEqual([]);
            expect(it.difficulty).toBe(d);
            expect(checkResponse(it, correctResponse(it))).toBe(true);
          }
        }
      });
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Semantics per generator                                            */
/* ------------------------------------------------------------------ */

const skillItems = (id: string, count = COUNT, difficulty?: 1 | 2 | 3 | 4 | 5) => generateItems(byId(id), count, { seed: SEED, difficulty });

/** equation "a OP b = c" in a prompt/template: returns parsed parts */
const EQ = /(\d+) ([+−]) (\d+) = (\d+)/;

describe('addition / subtraction at grade III-IV scale', () => {
  const cases: [string, '+' | '−', boolean | undefined, number][] = [
    ['mat.add.nocarry.1000', '+', false, 1000],
    ['mat.add.carry.1000', '+', true, 1000],
    ['mat.sub.noborrow.1000', '−', false, 1000],
    ['mat.sub.borrow.1000', '−', true, 1000],
    ['mat.add.1m', '+', undefined, 1000000],
    ['mat.sub.1m', '−', undefined, 1000000],
  ];
  for (const [id, sym, flag, max] of cases) {
    it(`${id}: operands obey the flag, the range and the real result`, () => {
      let seen = 0;
      for (const it of skillItems(id)) {
        const t = textOf(it);
        const filled = it.type === 'fill-gap' ? t.replace('{{gap}}', it.correct) : t;
        const m = new RegExp(`(\\d+) \\${sym} (\\d+)`).exec(filled) ?? (it.type === 'fill-gap' ? EQ.exec(filled) : null);
        const a = m ? Number(m[1]) : NaN;
        const b = m ? Number(m[2]) : NaN;
        if (!m) {
          // "read the arrows" items show the calculation in the options
          expect(it.type, `${it.id}: ${t}`).toBe('choice');
          continue;
        }
        seen++;
        const result = sym === '+' ? a + b : a - b;
        expect(result).toBeLessThanOrEqual(max);
        expect(result).toBeGreaterThanOrEqual(0);
        if (sym === '−') expect(a).toBeLessThanOrEqual(max);
        if (flag !== undefined && it.type !== 'true-false') {
          expect(columns(a, b, sym === '+' ? '+' : '-').carried, `${it.id}: ${a} ${sym} ${b}`).toBe(flag);
        }
        if (it.type === 'fill-gap') {
          expect(sym === '+' ? a + b : a - b, it.id).toBe(Number(EQ.exec(filled)![4]));
          continue;
        }
        const ans = answerOf(it);
        if (it.type === 'true-false') {
          const shown = Number(/= (\d+)$/.exec(t)![1]);
          expect(it.correct).toBe(shown === result);
        } else if (/Cât face/.test(t) || /= \{\{gap\}\}$/.test(t)) {
          expect(ans, it.id).toBe(result);
        } else if (it.type === 'fill-gap') {
          // gap in an operand: filling it makes the equation true
          const filled = t.replace('{{gap}}', it.correct);
          const e = EQ.exec(filled)!;
          expect(sym === '+' ? Number(e[1]) + Number(e[3]) : Number(e[1]) - Number(e[3])).toBe(Number(e[4]));
        }
      }
      expect(seen).toBeGreaterThan(150);
    });
  }

  it('mat.add.carry.1000 / mat.sub.borrow.1000 include multi-column cases and 3-digit operands', () => {
    const adds = skillItems('mat.add.carry.1000').map((i) => /(\d+) \+ (\d+)/.exec(textOf(i))).filter(Boolean) as RegExpExecArray[];
    expect(adds.some((m) => Number(m[1]) >= 100 && Number(m[2]) >= 100)).toBe(true);
    expect(adds.some((m) => columns(Number(m[1]), Number(m[2]), '+').carried && !(Number(m[1]) % 10 + Number(m[2]) % 10 >= 10))).toBe(true);
  });
});

describe('multiplication', () => {
  const TF = /^Adevărat sau fals: (\d+) × (\d+) = (\d+)$/;
  function checkMul(it: Item): number {
    const t = textOf(it);
    let m: RegExpExecArray | null;
    if (it.type === 'true-false' && (m = TF.exec(t))) {
      expect(it.correct, it.id).toBe(Number(m[1]) * Number(m[2]) === Number(m[3]));
    } else if ((m = /^Cât face (\d+) × (\d+)\?$/.exec(t))) {
      expect(answerOf(it), it.id).toBe(Number(m[1]) * Number(m[2]));
    } else if ((m = /^(\d+) × (\d+) = \{\{gap\}\}$/.exec(t))) {
      expect(answerOf(it), it.id).toBe(Number(m[1]) * Number(m[2]));
    } else if ((m = /^\{\{gap\}\} × (\d+) = (\d+)$/.exec(t))) {
      expect(answerOf(it)! * Number(m[1]), it.id).toBe(Number(m[2]));
    } else if ((m = /^(\d+) × \{\{gap\}\} = (\d+)$/.exec(t))) {
      expect(answerOf(it)! * Number(m[1]), it.id).toBe(Number(m[2]));
    } else if ((m = /^Sunt (\d+) grupe cu câte (\d+) .* Câte .* în total\?$/.exec(t))) {
      expect(answerOf(it), it.id).toBe(Number(m[1]) * Number(m[2]));
      expect(it.visual).toMatchObject({ kind: 'objects', groups: Number(m[1]), count: Number(m[1]) * Number(m[2]) });
    } else if ((m = /^(\d+) × (\d+) = (\d+) \+ \{\{gap\}\}$/.exec(t))) {
      expect(Number(m[3]) + answerOf(it)!, it.id).toBe(Number(m[1]) * Number(m[2]));
    } else if ((m = /^(\d+) × (\d+) = \{\{gap\}\} \+ (\d+)$/.exec(t))) {
      expect(Number(m[3]) + answerOf(it)!, it.id).toBe(Number(m[1]) * Number(m[2]));
    } else if ((m = /^(\d+) × (\d+) = ([\d + ]+) = \{\{gap\}\}$/.exec(t))) {
      expect(answerOf(it), it.id).toBe(Number(m[1]) * Number(m[2]));
      expect(m[3].split(' + ').map(Number).reduce((x, y) => x + y, 0)).toBe(Number(m[1]) * Number(m[2]));
    } else {
      throw new Error(`unrecognised multiplication item: ${t}`);
    }
    return 1;
  }

  it('table skills use only their factors and are exact', () => {
    for (const [id, tables] of [['mat.mul.table.small', [2, 3, 4, 5]], ['mat.mul.table.large', [6, 7, 8, 9, 10]]] as const) {
      for (const it of skillItems(id)) {
        checkMul(it);
        const nums = [...textOf(it).replace(/\{\{gap\}\}/g, ' ').matchAll(/\d+/g)].map((x) => Number(x[0]));
        // the first two numbers of the statement are the two factors (when the sentence has them in front)
        const m = /(\d+) × (\d+)/.exec(textOf(it)) ?? /^Sunt (\d+) grupe cu câte (\d+)/.exec(textOf(it));
        if (m && nums.length) expect(tables.includes(Number(m[1])) || tables.includes(Number(m[2])), it.id).toBe(true);
      }
    }
  });

  it('mat.mul.table.small uses object groups for small products', () => {
    expect(skillItems('mat.mul.table.small', COUNT, 2).some((i) => i.visual?.kind === 'objects' && (i.visual as { groups?: number }).groups)).toBe(true);
  });

  it('large skills multiply correctly within the limits', () => {
    for (const [id, bLo, bHi] of [['mat.mul.1digit', 2, 9], ['mat.mul.2digit', 10, 99]] as const) {
      let seen = 0;
      for (const it of skillItems(id)) {
        checkMul(it);
        const m = /(\d+) × (\d+)/.exec(textOf(it));
        if (m) {
          seen++;
          expect(Number(m[1]) * Number(m[2])).toBeLessThanOrEqual(1000000);
          expect(Number(m[2]), it.id).toBeGreaterThanOrEqual(bLo);
          expect(Number(m[2]), it.id).toBeLessThanOrEqual(bHi);
          expect(Number(m[1]), it.id).toBeGreaterThanOrEqual(10);
        }
      }
      expect(seen).toBeGreaterThan(100);
    }
  });
});

describe('division', () => {
  function checkExact(it: Item): void {
    const t = textOf(it);
    let m: RegExpExecArray | null;
    if (it.type === 'true-false' && (m = /^Adevărat sau fals: (\d+) : (\d+) = (\d+)$/.exec(t))) {
      expect(it.correct, it.id).toBe(Number(m[1]) / Number(m[2]) === Number(m[3]));
    } else if ((m = /^Cât face (\d+) : (\d+)\?$/.exec(t)) || (m = /^(\d+) : (\d+) = \{\{gap\}\}$/.exec(t))) {
      expect(Number(m[1]) % Number(m[2]), it.id).toBe(0);
      expect(answerOf(it), it.id).toBe(Number(m[1]) / Number(m[2]));
    } else if ((m = /^(\d+) : \{\{gap\}\} = (\d+)$/.exec(t))) {
      expect(Number(m[1]) / answerOf(it)!, it.id).toBe(Number(m[2]));
    } else if ((m = /^Știind că (\d+) × (\d+) = (\d+), avem (\d+) : (\d+) = \{\{gap\}\}$/.exec(t))) {
      expect(Number(m[1]) * Number(m[2])).toBe(Number(m[3]));
      expect(Number(m[4]) / Number(m[5]), it.id).toBe(answerOf(it));
    } else if ((m = /^Se împart în mod egal (\d+)(?: de)? .* în (\d+) grupe\./.exec(t))) {
      expect(answerOf(it), it.id).toBe(Number(m[1]) / Number(m[2]));
      expect(it.visual).toMatchObject({ kind: 'objects', count: Number(m[1]), groups: Number(m[2]) });
    } else {
      throw new Error(`unrecognised division item: ${t}`);
    }
  }

  it('table division is exact with the right divisors (division as inverse of multiplication)', () => {
    const items = skillItems('mat.div.table');
    for (const it of items) checkExact(it);
    expect(items.some((i) => /Știind că/.test(textOf(i)))).toBe(true);
    expect(items.some((i) => i.visual?.kind === 'objects')).toBe(true);
  });

  it('mat.div.1digit.exact: one-digit divisor, exact, dividend within the limit, never single trivial', () => {
    for (const it of skillItems('mat.div.1digit.exact')) {
      checkExact(it);
      const m = /(\d+) : (\d+)/.exec(textOf(it));
      if (m) {
        expect(Number(m[1])).toBeLessThanOrEqual(10000);
        expect(Number(m[2])).toBeGreaterThanOrEqual(2);
        expect(Number(m[2])).toBeLessThanOrEqual(9);
      }
    }
  });

  it('mat.div.1digit.rem: quotient/remainder are right and 0 < remainder < divisor', () => {
    let rest = 0;
    let quot = 0;
    for (const it of skillItems('mat.div.1digit.rem')) {
      const t = textOf(it);
      let m: RegExpExecArray | null;
      if ((m = /^Împarte (\d+) la (\d+)\. (?:Care este|Scrie) (câtul|restul)\.?\??$/.exec(t))) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        expect(a % b, it.id).toBeGreaterThan(0);
        expect(b).toBeLessThanOrEqual(9);
        expect(answerOf(it), it.id).toBe(m[3] === 'câtul' ? Math.floor(a / b) : a % b);
        if (m[3] === 'restul') rest++;
        else quot++;
      } else if ((m = /^(\d+) : (\d+) = (\d+) rest \{\{gap\}\}$/.exec(t))) {
        expect(answerOf(it)).toBe(Number(m[1]) % Number(m[2]));
        expect(Math.floor(Number(m[1]) / Number(m[2]))).toBe(Number(m[3]));
      } else if ((m = /^(\d+) = (\d+) × \{\{gap\}\} \+ (\d+)$/.exec(t))) {
        expect(Number(m[2]) * answerOf(it)! + Number(m[3]), it.id).toBe(Number(m[1]));
        expect(Number(m[3])).toBeLessThan(Number(m[2]));
        expect(Number(m[3])).toBeGreaterThan(0);
      } else if ((m = /^Adevărat sau fals: (\d+) : (\d+) = (\d+) rest (\d+)$/.exec(t))) {
        const [a, b, q, r] = m.slice(1).map(Number);
        expect(it.correct, it.id).toBe(Math.floor(a / b) === q && a % b === r);
      } else throw new Error(`unrecognised remainder item: ${t}`);
    }
    expect(rest).toBeGreaterThan(20);
    expect(quot).toBeGreaterThan(20);
  });
});

describe('equation', () => {
  const PARTS = /(\d+|\?|\{\{gap\}\}) ([+−×:]) (\d+|\?|\{\{gap\}\}) = (\d+)/;
  const apply = (x: number, op: string, y: number): number => (op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y);

  for (const [id, ops, max] of [
    ['mat.equation.unknown', '+−×:', 1000],
    ['mat.equation.big', '+−×:', 10000],
  ] as const) {
    it(`${id}: the stated answer makes the equation true (all four operations appear)`, () => {
      const seenOps = new Set<string>();
      for (const it of skillItems(id)) {
        const t = textOf(it);
        const m = PARTS.exec(t);
        expect(m, t).not.toBeNull();
        const [, l, op, r, z] = m!;
        expect(ops.includes(op)).toBe(true);
        seenOps.add(op);
        const holds = (hidden: number): boolean => {
          const x = l === '?' || l === '{{gap}}' ? hidden : Number(l);
          const y = r === '?' || r === '{{gap}}' ? hidden : Number(r);
          const v = apply(x, op, y);
          return Number.isInteger(v) && v === Number(z) && x > 0 && y > 0;
        };
        expect(Number(z)).toBeLessThanOrEqual(max);
        if (it.type === 'true-false') {
          const shown = Number(/este (\d+)$/.exec(t)![1]);
          expect(it.correct, it.id).toBe(holds(shown));
        } else {
          expect(holds(answerOf(it)!), `${it.id}: ${t} -> ${answerOf(it)}`).toBe(true);
        }
        // exactly one unknown, and never in the result position
        expect((t.match(/\?|\{\{gap\}\}/g) ?? []).length).toBeLessThanOrEqual(2); // true-false statement repeats "?"
      }
      expect([...seenOps].sort().join('')).toBe('+:×−'.split('').sort().join(''));
    });
  }

  it('choice distractors never solve the equation too', () => {
    for (const it of skillItems('mat.equation.unknown')) {
      if (it.type !== 'choice') continue;
      const m = PARTS.exec(textOf(it))!;
      const sat = (hidden: number) => {
        const x = m[1] === '?' ? hidden : Number(m[1]);
        const y = m[3] === '?' ? hidden : Number(m[3]);
        return apply(x, m[2], y) === Number(m[4]);
      };
      const good = it.options.filter((o) => sat(unfmt(o.text!.ro)));
      expect(good.map((o) => o.id), it.id).toEqual([it.correctId]);
    }
  });
});

/** Independent evaluation of "7 + 3 × 4" style text with × : − symbols */
function evalText(expr: string): number {
  const js = plain(expr).replace(/×/g, '*').replace(/:/g, '/').replace(/−/g, '-');
  // eslint-disable-next-line no-new-func
  return new Function(`return (${js});`)() as number;
}

describe('order of operations', () => {
  const EXPR = /[\d(][\d\s+−×:()]*[\d)]/;
  function exprIn(it: Item): string | undefined {
    const t = textOf(it);
    const m = /^(?:Calculează: |Cât face |Ce operație se efectuează prima în |Adevărat sau fals: )?(.*?)(?:\?| = \{\{gap\}\}| = \d+)?$/.exec(t);
    const e = m?.[1];
    return e && EXPR.test(e) && /[+−×:]/.test(e) ? e : undefined;
  }

  for (const [id, parens] of [['mat.order.noparen', false], ['mat.order.paren', true]] as const) {
    it(`${id}: results are exact, non-negative integers; ${parens ? 'parentheses change the result' : 'no parentheses'}`, () => {
      let checked = 0;
      for (const it of skillItems(id, COUNT, 3)) {
        const e = exprIn(it);
        expect(e, textOf(it)).toBeDefined();
        const value = evalText(e!);
        expect(Number.isInteger(value) && value >= 0 && value <= 100, `${e} = ${value}`).toBe(true);
        expect(e!.includes('('), e).toBe(parens);
        if (parens) expect(evalText(e!.replace(/[()]/g, '')), `parentheses must matter: ${e}`).not.toBe(value);
        else {
          // precedence must matter: left-to-right gives something else
          const nums = e!.split(/\s*[+−×:]\s*/).map(Number);
          const syms = [...e!.matchAll(/[+−×:]/g)].map((x) => x[0]);
          let acc = nums[0];
          syms.forEach((s, i) => (acc = s === '+' ? acc + nums[i + 1] : s === '−' ? acc - nums[i + 1] : s === '×' ? acc * nums[i + 1] : acc / nums[i + 1]));
          expect(acc, `precedence must matter: ${e}`).not.toBe(value);
        }
        const ans = answerOf(it);
        if (it.type === 'true-false') {
          const shown = Number(/= (\d+)$/.exec(textOf(it))![1]);
          expect(it.correct).toBe(shown === value);
        } else if (it.type === 'number-input' || it.type === 'fill-gap' || (it.type === 'choice' && /^Cât face/.test(it.prompt.ro))) {
          expect(ans, it.id).toBe(value);
        } else if (it.type === 'choice') {
          // "which operation first?": the correct option is evaluated first
          const correct = plain(it.options.find((o) => o.id === it.correctId)!.text!.ro);
          expect(e!.includes(correct)).toBe(true);
          if (parens) expect(e!.includes(`(${correct})`), `${e} -> ${correct}`).toBe(true);
          else if (/[×:]/.test(e!)) expect(/[×:]/.test(correct), `${e} -> ${correct}`).toBe(true);
        }
        checked++;
      }
      expect(checked).toBe(COUNT);
    });
  }

  it('the classic wrong answer (ignoring precedence / parentheses) is offered among the choices', () => {
    let offered = 0;
    let total = 0;
    for (const it of skillItems('mat.order.noparen', 400, 3)) {
      if (it.type !== 'choice' || !/^Cât face/.test(it.prompt.ro)) continue;
      total++;
      const e = exprIn(it)!;
      const nums = e.split(/\s*[+−×:]\s*/).map(Number);
      const syms = [...e.matchAll(/[+−×:]/g)].map((x) => x[0]);
      let acc = nums[0];
      syms.forEach((s, i) => (acc = s === '+' ? acc + nums[i + 1] : s === '−' ? acc - nums[i + 1] : s === '×' ? acc * nums[i + 1] : acc / nums[i + 1]));
      if (!Number.isInteger(acc) || acc < 0 || acc === evalText(e)) {
        total--; // the slip gives a non-number here: nothing to offer
        continue;
      }
      if (it.options.some((o) => unfmt(o.text!.ro) === acc)) offered++;
    }
    expect(total).toBeGreaterThan(15);
    expect(offered / total).toBeGreaterThan(0.95);
  });

  it('mat.order.ops mixes parenthesised and plain expressions with bigger numbers', () => {
    const items = skillItems('mat.order.ops', COUNT, 4);
    const exprs = items.map(exprIn).filter(Boolean) as string[];
    expect(exprs.some((e) => e.includes('('))).toBe(true);
    expect(exprs.some((e) => !e.includes('('))).toBe(true);
    for (const e of exprs) {
      const v = evalText(e);
      expect(Number.isInteger(v) && v >= 0 && v <= 1000, `${e} = ${v}`).toBe(true);
    }
  });
});

describe('rounding', () => {
  it('rounds half up to tens / hundreds / thousands and shows only the number on the line', () => {
    const units = new Set<number>();
    let n = 0;
    for (const it of skillItems('mat.round')) {
      const t = textOf(it);
      let m: RegExpExecArray | null;
      if ((m = /^Rotunjește numărul (\d+) la (zeci|sute|mii)\.$/.exec(t))) {
        const unit = { zeci: 10, sute: 100, mii: 1000 }[m[2] as 'zeci' | 'sute' | 'mii'];
        units.add(unit);
        const value = Number(m[1]);
        expect(value % unit, it.id).not.toBe(0);
        expect(answerOf(it), it.id).toBe(roundTo(value, unit));
        expect(Math.abs((answerOf(it) as number) - value)).toBeLessThanOrEqual(unit / 2);
        if (it.visual?.kind === 'number-line') {
          expect(it.visual.marks).toEqual([value]);
          expect(it.visual.to - it.visual.from).toBe(unit);
        }
        n++;
      } else if ((m = /^Adevărat sau fals: (\d+) rotunjit la (zeci|sute|mii) este (\d+)$/.exec(t))) {
        const unit = { zeci: 10, sute: 100, mii: 1000 }[m[2] as 'zeci' | 'sute' | 'mii'];
        expect(it.type === 'true-false' && it.correct, it.id).toBe(roundTo(Number(m[1]), unit) === Number(m[3]));
      } else if ((m = /^Între ce două (zeci|sute|mii) consecutive se află (\d+)\?$/.exec(t))) {
        const unit = { zeci: 10, sute: 100, mii: 1000 }[m[1] as 'zeci' | 'sute' | 'mii'];
        const value = Number(m[2]);
        const correct = it.type === 'choice' ? it.options.find((o) => o.id === it.correctId)!.text!.ro : '';
        const [lo, hi] = plain(correct).split(' și ').map(Number);
        expect(hi - lo).toBe(unit);
        expect(lo <= value && value < hi).toBe(true);
      } else throw new Error(`unrecognised rounding item: ${t}`);
    }
    expect(n).toBeGreaterThan(40);
    expect([...units].sort((a, b) => a - b)).toEqual([10, 100, 1000]);
  });

  it('roundTo follows the school rule (5 rounds up)', () => {
    expect(roundTo(4567, 100)).toBe(4600);
    expect(roundTo(4532, 100)).toBe(4500);
    expect(roundTo(4550, 100)).toBe(4600);
    expect(roundTo(45, 10)).toBe(50);
    expect(roundTo(44, 10)).toBe(40);
    expect(roundTo(999999, 1000)).toBe(1000000);
  });
});

describe('number reading', () => {
  it('words skills: digits <-> Romanian words agree (both directions)', () => {
    for (const [id, max] of [['mat.num.1000.read', 1000], ['mat.num.1m.read', 1000000]] as const) {
      let read = 0;
      let write = 0;
      for (const it of skillItems(id)) {
        const t = plain(it.type === 'fill-gap' ? it.template.ro : it.prompt.ro);
        let m: RegExpExecArray | null;
        if ((m = /^Cum se citește numărul (\d+)\?$/.exec(t))) {
          const n = Number(m[1]);
          expect(n).toBeLessThanOrEqual(max);
          const correct = (it as { options: { id: string; text?: { ro: string } }[] }).options.find((o) => o.id === (it as { correctId: string }).correctId)!;
          expect(correct.text!.ro).toBe(roNumber(n));
          read++;
        } else if ((m = /^Cum se scrie cu cifre: (.*)\?$/.exec(t))) {
          const n = answerOf(it)!;
          expect(roNumber(n)).toBe(m[1]);
          expect(n).toBeLessThanOrEqual(max);
          write++;
        } else if ((m = /^Scrie cu cifre: (.*)\.$/.exec(t))) {
          expect(roNumber(answerOf(it)!)).toBe(m[1]);
          write++;
        } else if ((m = /^Adevărat sau fals: (.*) se scrie (\d+)$/.exec(t))) {
          expect((it as { correct: boolean }).correct).toBe(roNumber(Number(m[2])) === m[1]);
        } else throw new Error(`unrecognised number-reading item: ${t}`);
      }
      expect(read).toBeGreaterThan(20);
      expect(write).toBeGreaterThan(40);
    }
  });

  it('grade IV items include numbers with thousands (o mie / două mii / "de mii") and inner zeros', () => {
    const words = skillItems('mat.num.1m.read', 400).flatMap((i) => (i.type === 'choice' ? i.options.map((o) => o.text?.ro ?? '') : [i.prompt.ro]));
    expect(words.some((w) => / de mii/.test(w))).toBe(true);
    expect(words.some((w) => /\bmii\b/.test(w) && !/ de mii/.test(w))).toBe(true);
    expect(words.some((w) => /^o mie|^două mii|^două sute/.test(w))).toBe(true);
  });

  it('place-value skills: digit/value/decomposition answers are right; blocks appear below 1000', () => {
    for (const id of ['mat.num.1000.place', 'mat.num.1m.place']) {
      const items = skillItems(id);
      for (const it of items) {
        const t = textOf(it);
        let m: RegExpExecArray | null;
        if ((m = /^Care este cifra (.*) din (\d+)\?$/.exec(t))) {
          const order = ['unităților', 'zecilor', 'sutelor', 'miilor', 'zecilor de mii', 'sutelor de mii'].indexOf(m[1]);
          expect(order).toBeGreaterThanOrEqual(0);
          expect(answerOf(it)).toBe(Math.floor(Number(m[2]) / 10 ** order) % 10);
        } else if ((m = /^Ce valoare are cifra (\d) în numărul (\d+)\?$/.exec(t))) {
          const s = m[2];
          const i = s.indexOf(m[1]);
          expect(s.lastIndexOf(m[1]), 'digit must be unambiguous').toBe(i);
          expect(answerOf(it)).toBe(Number(m[1]) * 10 ** (s.length - 1 - i));
        } else if ((m = /^(\d+) = (.*)$/.exec(t)) && it.type === 'fill-gap') {
          const parts = m[2].split(' + ');
          const total = parts.reduce((sum, p, k) => {
            const w = parts.length;
            const digit = p.startsWith('{{gap}}') ? Number(it.correct) : Number(p.split(' ')[0]);
            const label = p.replace(/^(\{\{gap\}\}|\d) /, '');
            expect(digit === 1 && !p.startsWith('{{gap}}') ? /^(unitate|zece|sută|mie|zece de mii|sută de mii)$/.test(label) : /^(unități|zeci|sute|mii|zeci de mii|sute de mii)$/.test(label), p).toBe(true);
            return sum + digit * 10 ** (w - 1 - k);
          }, 0);
          expect(total, it.id).toBe(Number(m[1]));
        } else if ((m = /^Scrie numărul: (.*)\.$/.exec(t))) {
          const orders: Record<string, number> = {
            unități: 0, unitate: 0, zeci: 1, zece: 1, sute: 2, sută: 2, mii: 3, mie: 3,
            'zeci de mii': 4, 'zece de mii': 4, 'sute de mii': 5, 'sută de mii': 5,
          };
          for (const p of m[1].split(' + ')) {
            const [digit, ...rest] = p.split(' ');
            if (digit === '1') expect(['unitate', 'zece', 'sută', 'mie', 'zece de mii', 'sută de mii'], p).toContain(rest.join(' '));
          }
          const total = m[1].split(' + ').reduce((sum, p) => {
            const [d, ...rest] = p.split(' ');
            return sum + Number(d) * 10 ** orders[rest.join(' ')];
          }, 0);
          expect(answerOf(it)).toBe(total);
        } else if ((m = /^Scrie cu cifre: (.*)\.$/.exec(t))) {
          expect(roNumber(answerOf(it)!)).toBe(m[1]); // fallback when no digit is unambiguous (e.g. 770)
        } else if (it.prompt.ro.startsWith('Ordonează')) {
          expect(it.type).toBe('order');
        } else if (/cuburi/.test(it.prompt.ro)) {
          const v = it.visual as { hundreds?: number; tens?: number; ones?: number };
          expect(answerOf(it)).toBe((v.hundreds ?? 0) * 100 + (v.tens ?? 0) * 10 + (v.ones ?? 0));
        } else throw new Error(`unrecognised place-value item: ${t}`);
      }
    }
    expect(skillItems('mat.num.1000.place').some((i) => i.visual?.kind === 'base10-blocks')).toBe(true);
  });

  it('order items are sorted correctly', () => {
    let seen = 0;
    for (const it of skillItems('mat.num.1m.place', 400)) {
      if (it.type !== 'order') continue;
      const asc = /cel mai mic la cel mai mare/.test(it.prompt.ro);
      const values = it.correctOrder.map((id) => Number(id.slice(1)));
      const sorted = [...values].sort((a, b) => (asc ? a - b : b - a));
      expect(values).toEqual(sorted);
      seen++;
    }
    expect(seen).toBeGreaterThan(5);
  });
});

describe('word problems with multiplication and division', () => {
  it('mat.wordproblem.muldiv: the answer is the product, or the quotient, of the two numbers in the text', () => {
    let mul = 0;
    let div = 0;
    for (const it of skillItems('mat.wordproblem.muldiv')) {
      const t = plain(it.prompt.ro);
      expect(t).toMatch(/\?$/);
      expect(it.prompt.en).toMatch(/\?$/);
      const nums = [...t.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
      expect(nums.length, t).toBe(2);
      for (const x of nums) expect(x).toBeGreaterThanOrEqual(2);
      const a = answerOf(it)!;
      expect(a, t).toBeGreaterThanOrEqual(2);
      const isMul = a === nums[0] * nums[1];
      const isDiv = nums[0] === a * nums[1];
      expect(isMul || isDiv, `${t} -> ${a}`).toBe(true);
      if (isMul) mul++;
      if (isDiv) div++;
      if (it.visual?.kind === 'objects') expect((it.visual as { groups?: number }).groups).toBeGreaterThanOrEqual(2);
    }
    expect(mul).toBeGreaterThan(40);
    expect(div).toBeGreaterThan(40);
  });

  it('Romanian "de" rule appears with counts of 20 and above', () => {
    const items = generateItems(
      { ...byId('mat.wordproblem.muldiv'), itemSources: [{ generator: 'word-problem', params: { max: 1000, ops: ['*', '/'], factorMax: 40, groupsMax: 30 } }] },
      200,
      { seed: 3, difficulty: 4 },
    );
    let withDe = 0;
    for (const it of items) {
      const t = plain(it.prompt.ro);
      for (const m of t.matchAll(/\b(\d+) (de )?(?=[a-zăâîșț])/g)) {
        const n = Number(m[1]);
        const need = n % 100 === 0 || n % 100 >= 20;
        if (n >= 2 && /^\d+ (de )?[a-zăâîșț]+/.test(m[0])) {
          // only check numerals directly followed by a plural noun, not "câte 25 într-o cutie"
          if (!/^(într|în|cu |și|iar|pe )/.test(t.slice((m.index ?? 0) + m[0].length))) expect(Boolean(m[2]), `${t} (${n})`).toBe(need);
          if (m[2]) withDe++;
        }
      }
    }
    expect(withDe).toBeGreaterThan(10);
  });

  it('mat.wordproblem.1000 stays within 1000 and keeps one or two steps', () => {
    for (const it of skillItems('mat.wordproblem.1000')) {
      const a = answerOf(it)!;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1000);
      for (const m of plain(it.prompt.ro).matchAll(/\b(\d+)\b/g)) expect(Number(m[1])).toBeLessThanOrEqual(1000);
    }
  });

  it('mat.wordproblem.multistep: remainder problems ask for full groups or what is left', () => {
    let rem = 0;
    for (const it of skillItems('mat.wordproblem.multistep', 400)) {
      const t = plain(it.prompt.ro);
      const m = /are (\d+) .* și le pune câte (\d+) .*(pline poate face|rămân)\?$/.exec(t);
      if (!m) continue;
      rem++;
      const [total, k] = [Number(m[1]), Number(m[2])];
      expect(total % k).toBeGreaterThan(0);
      expect(answerOf(it)).toBe(m[3] === 'rămân' ? total % k : Math.floor(total / k));
    }
    expect(rem).toBeGreaterThan(10);
  });
});

/* ------------------------------------------------------------------ */
/*  Performance                                                        */
/* ------------------------------------------------------------------ */

describe('performance', () => {
  const big = newSkills.filter((s) => sourcesOf(s).some((src) => Number((src.params as { max?: number } | undefined)?.max ?? 0) >= 1000000));

  it('has several skills with max = 1 000 000', () => {
    expect(ids(big)).toEqual(expect.arrayContaining(['mat.add.1m', 'mat.sub.1m', 'mat.num.1m.read']));
  });

  for (const skill of big) {
    it(`${skill.id}: 200 items in < 500 ms`, () => {
      generateItems(skill, 20, { seed: 1 }); // warm-up
      const t0 = performance.now();
      const items = generateItems(skill, 200, { seed: 2 });
      const ms = performance.now() - t0;
      expect(items).toHaveLength(200);
      expect(ms, `${skill.id}: ${ms.toFixed(0)} ms`).toBeLessThan(500);
    });
  }

  it('all grade III-IV skills together stay fast (no enumeration anywhere)', () => {
    const t0 = performance.now();
    for (const s of newSkills) generateItems(s, 200, { seed: 7 });
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});
