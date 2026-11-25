import { describe, it, expect } from 'vitest';
import { getSkillsBySubject } from '../src/engine/content/registry';
import { validateItem } from '../src/engine/content/validate';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators, registerGenerator } from '../src/engine/items/generators';
import { addCarries, subBorrows } from '../src/engine/items/generators/arithmetic';
import { enWord, roWord } from '../src/engine/items/generators/words';
import type { Item, ItemResponse, Skill } from '../src/engine/types';

const SEED = 20240611;
const COUNT = 200;
const skills: Skill[] = getSkillsBySubject('mat');

/** The response a perfect child would give */
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
    case 'sort':
      return { type: 'sort', placement: Object.fromEntries(item.cards.map((c) => [c.id, c.categoryId])) };
    case 'match':
      return { type: 'match', pairs: Object.fromEntries(item.pairs.map((p) => [p.left.id, p.right.id])) };
    case 'read-and-answer':
      throw new Error('not generated');
  }
}

/** Numeric value of the correct answer, when it is a plain number */
function numericAnswer(item: Item): number | undefined {
  let raw: string | number | undefined;
  if (item.type === 'number-input') raw = item.correct;
  else if (item.type === 'fill-gap') raw = item.correct;
  else if (item.type === 'choice') raw = item.options.find((o) => o.id === item.correctId)?.text?.ro;
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && String(raw).trim() !== '' ? n : undefined;
}

const generated = (items: Item[]) => items.filter((i) => i.id.startsWith('gen.'));
const generatorName = (skill: Skill) => (skill.itemSources.find((s) => 'generator' in s) as { generator: string }).generator;
const paramsOf = (skill: Skill) => ((skill.itemSources.find((s) => 'generator' in s) as { params?: Record<string, unknown> }).params ?? {});

/** Pull "a + b" / "a − b" out of an arithmetic item */
function parseEquation(item: Item): { a: number; sym: string; b: number; c?: number } | undefined {
  let text = item.prompt.ro;
  if (item.type === 'fill-gap') text = item.template.ro.replace('{{gap}}', item.correct);
  else if (item.type === 'choice') {
    const correct = item.options.find((o) => o.id === item.correctId)?.text?.ro;
    if (correct && /\d+ [+−] \d+/.test(correct)) text = correct;
  }
  const m = /(\d+) ([+−]) (\d+)(?: = (\d+))?/.exec(text);
  if (!m) return undefined;
  return { a: Number(m[1]), sym: m[2], b: Number(m[3]), c: m[4] === undefined ? undefined : Number(m[4]) };
}

describe('generator registry', () => {
  it('has a generator for every name referenced by content', () => {
    const referenced = new Set<string>();
    for (const s of skills) for (const src of s.itemSources) if ('generator' in src) referenced.add(src.generator);
    expect(referenced.size).toBeGreaterThanOrEqual(7);
    for (const name of referenced) expect(getGenerator(name), name).toBeTypeOf('function');
    expect(listGenerators()).toEqual(
      expect.arrayContaining(['addition', 'compare', 'counting', 'number-recognition', 'place-value', 'subtraction', 'word-problem']),
    );
  });

  it('registerGenerator adds custom generators and generateItems stamps ids/provenance', () => {
    registerGenerator('test-custom', (_p, ctx) => ({
      id: 'ignored', type: 'number-input', skillId: ctx.skill.id, difficulty: ctx.difficulty, prompt: { ro: '1+1?' },
      correct: 2, reviewStatus: 'beta',
      provenance: { id: 'x', kind: 'item', title: 'x', author: 'x', source: 'own', licence: 'OWN' },
    }));
    const skill = { ...skills[0], id: 'mat.test.custom', itemSources: [{ generator: 'test-custom' }], explanations: ['exp.x'] } as Skill;
    const [it] = generateItems(skill, 1, { seed: 7 });
    expect(it.id).toBe('gen.mat.test.custom.7.0');
    expect(it.provenance.id).toBe(it.id);
    expect(it.explanationId).toBe('exp.x');
    expect(validateItem(it)).toEqual([]);
  });

  it('throws a clear error for an unknown generator', () => {
    const skill = { ...skills[0], itemSources: [{ generator: 'nope' }] } as Skill;
    expect(() => generateItems(skill, 1, { seed: 1 })).toThrow(/nope/);
  });
});

describe('number words', () => {
  it('spells Romanian and English numbers', () => {
    expect(roWord(0)).toBe('zero');
    expect(roWord(12)).toBe('doisprezece');
    expect(roWord(47)).toBe('patruzeci și șapte');
    expect(roWord(100)).toBe('o sută');
    expect(enWord(47)).toBe('forty-seven');
  });
});

describe('generators over every mat skill', () => {
  it('covers the 18 grade 0-II skills', () => {
    expect(skills.length).toBeGreaterThanOrEqual(18);
  });

  for (const skill of skills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });
      const gen = generated(items);
      const max = Number(paramsOf(skill).max ?? 20);
      const name = generatorName(skill);

      it('produces the requested number of items, mostly generated', () => {
        expect(items).toHaveLength(COUNT);
        expect(gen.length).toBeGreaterThanOrEqual(COUNT * 0.7);
      });

      it('every item passes validateItem with zero errors', () => {
        for (const it of items) expect(validateItem(it), it.id).toEqual([]);
      });

      it('ids are unique and follow gen.<skillId>.<seed>.<index>', () => {
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
        for (const it of gen) {
          expect(it.id).toMatch(new RegExp(`^gen\\.${skill.id.replace(/\./g, '\\.')}\\.${SEED}\\.\\d+$`));
          expect(it.skillId).toBe(skill.id);
          expect(it.reviewStatus).toBe('auto-checked');
          expect(it.provenance).toEqual({
            id: it.id, kind: 'item', title: expect.any(String), author: 'Ludiko', source: 'generated', licence: 'OWN',
          });
          expect(it.prompt.en, it.id).toBeTruthy();
          if (skill.explanations.length) expect(it.explanationId).toBe(skill.explanations[0]);
          else expect(it.explanationId).toBeUndefined();
        }
      });

      it('the correct response checks out, and no other choice does', () => {
        for (const it of items) {
          expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
          if (it.type === 'choice' || it.type === 'picture-choice') {
            for (const o of it.options) {
              if (o.id !== it.correctId) expect(checkResponse(it, { type: it.type, selectedId: o.id }), it.id).toBe(false);
            }
          }
          if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct })).toBe(false);
        }
      });

      it('distractors are unique and non-negative', () => {
        for (const it of gen) {
          if (it.type === 'choice' || it.type === 'picture-choice') {
            const keys = it.options.map((o) => JSON.stringify([o.text, o.visual]));
            expect(new Set(keys).size, it.id).toBe(keys.length);
            expect(it.options.length, it.id).toBeGreaterThanOrEqual(2);
            for (const o of it.options) {
              const n = Number(o.text?.ro);
              if (o.text && /^\d+$/.test(o.text.ro)) expect(n).toBeGreaterThanOrEqual(0);
            }
          }
          if (it.type === 'fill-gap' && it.options) {
            expect(new Set(it.options).size, it.id).toBe(it.options.length);
            for (const o of it.options) if (/^-?\d+$/.test(o)) expect(Number(o)).toBeGreaterThanOrEqual(0);
          }
          if (it.type === 'order') {
            const texts = it.cards.map((c) => c.text?.ro);
            expect(new Set(texts).size, it.id).toBe(texts.length);
          }
        }
      });

      it('numeric answers lie within [0, max]', () => {
        for (const it of gen) {
          const n = numericAnswer(it);
          if (n !== undefined) {
            expect(n, it.id).toBeGreaterThanOrEqual(0);
            expect(n, it.id).toBeLessThanOrEqual(max);
          }
        }
      });

      it('is deterministic for the same seed and differs for another', () => {
        expect(JSON.stringify(generateItems(skill, COUNT, { seed: SEED }))).toBe(JSON.stringify(items));
        const other = generateItems(skill, 30, { seed: SEED + 1 });
        expect(JSON.stringify(other.map((i) => i.prompt))).not.toBe(JSON.stringify(items.slice(0, 30).map((i) => i.prompt)));
      });

      it('mixes several item types', () => {
        const types = new Set(gen.map((i) => i.type));
        expect(types.size, [...types].join()).toBeGreaterThanOrEqual(name === 'word-problem' ? 2 : 3);
      });

      if (name === 'addition' || name === 'subtraction') {
        const isAdd = name === 'addition';
        const flag = paramsOf(skill)[isAdd ? 'carry' : 'borrow'] as boolean | undefined;

        it(`respects ${isAdd ? 'carry' : 'borrow'}=${String(flag)} and the range`, () => {
          for (const it of gen) {
            const eq = parseEquation(it);
            expect(eq, `${it.id}: ${it.prompt.ro}`).toBeDefined();
            const { a, sym, b, c } = eq!;
            expect(sym).toBe(isAdd ? '+' : '−');
            const result = isAdd ? a + b : a - b;
            if (isAdd) expect(result).toBeLessThanOrEqual(max);
            else {
              expect(a).toBeLessThanOrEqual(max);
              expect(result).toBeGreaterThanOrEqual(0);
            }
            expect(Math.min(a, b)).toBeGreaterThanOrEqual(1);
            if (c !== undefined && it.type !== 'true-false') expect(c, it.id).toBe(result);
            if (flag !== undefined) {
              const crosses = isAdd ? addCarries(a, b) : subBorrows(a, b);
              expect(crosses, `${it.id}: ${a} ${sym} ${b}`).toBe(flag);
            }
          }
        });

        it('number-input / choice answers equal the real result', () => {
          for (const it of gen) {
            const eq = parseEquation(it)!;
            const result = isAdd ? eq.a + eq.b : eq.a - eq.b;
            if (it.type === 'number-input') expect(it.correct).toBe(result);
            if (it.type === 'true-false') {
              const shown = Number(/= (\d+)/.exec(it.prompt.ro)![1]);
              expect(it.correct).toBe(shown === result);
            }
            if (it.type === 'choice' && /^Cât face/.test(it.prompt.ro)) expect(numericAnswer(it)).toBe(result);
          }
        });

        it('number-line visuals never draw the answer as a jump target (except in "read the arrows" items)', () => {
          for (const it of gen) {
            if (it.visual?.kind !== 'number-line' || it.prompt.ro.startsWith('Ce calcul')) continue;
            const n = numericAnswer(it);
            for (const j of it.visual.jumps ?? []) expect(j.to, it.id).not.toBe(n);
          }
        });
      }

      if (name === 'word-problem') {
        it('has original ro + en question text with a question mark', () => {
          for (const it of gen) {
            expect(it.prompt.ro).toMatch(/\?$/);
            expect(it.prompt.en).toMatch(/\?$/);
            expect(it.prompt.ro.length).toBeGreaterThan(30);
          }
        });
        it('mentions operands of at least 2 only (no singular agreement issues)', () => {
          for (const it of gen) for (const m of it.prompt.ro.matchAll(/\b(\d+)\b/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(2);
        });
      }

      if (name === 'place-value') {
        it('uses base10-blocks visuals and tens/ones wording', () => {
          const kinds = new Set(gen.map((i) => i.visual?.kind ?? (i.type === 'match' ? 'match' : i.type)));
          expect(kinds.has('base10-blocks') || kinds.has('match')).toBe(true);
          expect(gen.some((i) => /zeci|unități/.test(i.prompt.ro) || (i.type === 'fill-gap' && /zeci|unități/.test(i.template.ro)))).toBe(true);
        });
      }

      if (name === 'counting') {
        it('uses objects (or blocks) visuals', () => {
          expect(gen.some((i) => i.visual?.kind === 'objects' || i.visual?.kind === 'base10-blocks')).toBe(true);
        });
      }
    });
  }
});

describe('difficulty option', () => {
  it('pins every generated item to the requested difficulty', () => {
    const skill = skills.find((s) => s.id === 'mat.add.carry.20')!;
    for (const d of [1, 3, 5] as const) {
      for (const it of generated(generateItems(skill, 40, { seed: 3, difficulty: d }))) expect(it.difficulty).toBe(d);
    }
  });

  it('default seed is random but items stay valid', () => {
    const skill = skills.find((s) => s.id === 'mat.compare.10')!;
    for (const it of generateItems(skill, 20)) expect(validateItem(it), it.id).toEqual([]);
  });
});
