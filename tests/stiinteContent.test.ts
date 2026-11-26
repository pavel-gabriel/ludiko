import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator } from '../src/engine/items/generators';
import { CLASS_SETS, RELATIONS, SEQUENCES } from '../src/engine/items/generators/stiinteData';
import { LEARN_SUBJECTS } from '../src/ui/learn/subjects';
import type { Item, ItemResponse, Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));
function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsonFiles(p) : n.endsWith('.json') ? [p] : [];
  });
}

const skills = getSkillsBySubject('stiinte');

function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice': case 'picture-choice': case 'listen-and-answer': case 'hotspot':
      return { type: item.type, selectedId: item.correctId };
    case 'true-false': return { type: 'true-false', value: item.correct };
    case 'number-input': return { type: 'number-input', value: item.correct };
    case 'fill-gap': return { type: 'fill-gap', value: item.correct };
    case 'order': return { type: 'order', order: item.correctOrder };
    case 'sort': return { type: 'sort', placement: Object.fromEntries(item.cards.map((c) => [c.id, c.categoryId])) };
    case 'match': return { type: 'match', pairs: Object.fromEntries(item.pairs.map((p) => [p.left.id, p.right.id])) };
    case 'read-and-answer':
      return { type: 'read-and-answer', answers: Object.fromEntries(item.questions.map((q) => [q.id, correctResponse(q)])) };
  }
}

describe('stiinte skill graph', () => {
  it('has 20-30 valid skills in grades III and IV', () => {
    expect(skills.length).toBeGreaterThanOrEqual(20);
    expect(skills.length).toBeLessThanOrEqual(30);
    expect(new Set(skills.map((s) => s.grade))).toEqual(new Set([3, 4]));
    for (const g of [3, 4]) expect(getSkillsBySubject('stiinte', g as 3 | 4).length).toBeGreaterThanOrEqual(10);
    const errors = jsonFiles(join(CONTENT, 'skills', 'stiinte')).flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph is a valid DAG, prerequisites stay in the subject and cross grades', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    const byId = new Map(skills.map((s) => [s.id, s]));
    for (const s of skills) for (const p of s.prerequisites) expect(p.startsWith('stiinte.'), `${s.id} -> ${p}`).toBe(true);
    const crossing = skills.filter((s) => s.prerequisites.some((p) => (byId.get(p) as Skill).grade < s.grade));
    expect(crossing.length).toBeGreaterThanOrEqual(6);
  });

  it('uses STI-III-IV-2014 (codes to verify), own provenance, English titles', () => {
    for (const s of skills) {
      expect(s.competences.every((c) => c.programa === 'STI-III-IV-2014'), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en).toBeTruthy();
    }
  });

  it('every skill has a 3-frame explanation (ai-draft, beta, OWN) and is backed by a generator or bank', () => {
    for (const s of skills) {
      expect(s.explanations.length).toBe(1);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      for (const f of exp?.frames ?? []) expect(f.text.en).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
      for (const src of s.itemSources) if ('generator' in src) expect(getGenerator(src.generator), s.id).toBeTypeOf('function');
      if (!s.itemSources.some((x) => 'generator' in x)) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('is offered in the learner area', () => {
    expect(LEARN_SUBJECTS).toContain('stiinte');
  });
});

describe('stiinte static banks', () => {
  const files = jsonFiles(join(CONTENT, 'items', 'stiinte'));
  const items = files.flatMap((f) => readJson(f) as Item[]);

  it('has at least 60 valid items, including about 8+ read-and-answer texts', () => {
    expect(items.length).toBeGreaterThanOrEqual(60);
    expect(items.filter((i) => i.type === 'read-and-answer').length).toBeGreaterThanOrEqual(8);
    for (const it of items) expect(validateItem(it), it.id).toEqual([]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('items point at existing stiinte skills and explanations; provenance is own/ai-draft/OWN', () => {
    const ids = new Set(skills.map((s) => s.id));
    for (const it of items) {
      expect(ids.has(it.skillId), it.id).toBe(true);
      expect(getExplanation(it.explanationId ?? ''), it.id).toBeDefined();
      expect(it.reviewStatus).toBe('beta');
      expect(validateProvenance(it.provenance)).toEqual([]);
      expect(it.provenance.licence).toBe('OWN');
    }
  });

  it('checkResponse accepts the perfect answer and rejects a wrong one', () => {
    for (const it of items) {
      expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
      if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct })).toBe(false);
      if (it.type === 'number-input') expect(checkResponse(it, { type: 'number-input', value: it.correct + 1 })).toBe(false);
      if (it.type === 'choice') {
        const wrong = it.options.find((o) => o.id !== it.correctId) as { id: string };
        expect(checkResponse(it, { type: 'choice', selectedId: wrong.id })).toBe(false);
      }
    }
  });

  it('choice options are unique and the correct one is never duplicated', () => {
    for (const it of items) {
      if (it.type !== 'choice') continue;
      const texts = it.options.map((o) => o.text?.ro);
      expect(new Set(texts).size, it.id).toBe(texts.length);
    }
  });
});

describe('stiinte generators', () => {
  const genSkills = skills.filter((s) => s.itemSources.some((x) => 'generator' in x));

  it('most skills use generators', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(15);
  });

  for (const s of genSkills) {
    it(`${s.id}: 200 valid, verifiable items`, () => {
      const generated = generateItems(s, 200, { seed: 7 });
      expect(generated).toHaveLength(200);
      for (const it of generated) {
        expect(validateItem(it), it.id).toEqual([]);
        expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
      }
      const gen = generated.filter((i) => i.id.startsWith('gen.'));
      expect(gen.length).toBeGreaterThan(100);
    });
  }

  it('is deterministic for a seed', () => {
    const s = skills.find((x) => x.id === 'stiinte.animals.groups') as Skill;
    expect(generateItems(s, 30, { seed: 3 })).toEqual(generateItems(s, 30, { seed: 3 }));
  });

  it('order items never start solved and choice items have exactly one correct option', () => {
    for (const s of genSkills) {
      for (const it of generateItems(s, 100, { seed: 11 })) {
        if (it.type === 'order') expect(it.cards.map((c) => c.id)).not.toEqual(it.correctOrder);
        if (it.type === 'choice') {
          const ids = it.options.map((o) => o.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.filter((i) => i === it.correctId)).toHaveLength(1);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Fact tables: classifications must be unambiguous and correct       */
/* ------------------------------------------------------------------ */

const catOf = (set: string, en: string): string | undefined =>
  CLASS_SETS[set].cats.find((c) => c.things.some((t) => t.en === en))?.id;

describe('stiinte fact tables', () => {
  it('every thing belongs to exactly one category of its set; names are unique inside a category', () => {
    for (const set of Object.values(CLASS_SETS)) {
      const seen = new Map<string, string>();
      for (const c of set.cats) {
        for (const t of c.things) {
          expect(seen.has(t.en), `${set.id}: ${t.en} appears in ${seen.get(t.en)} and ${c.id}`).toBe(false);
          seen.set(t.en, c.id);
          expect(t.ro && t.d && t.en).toBeTruthy();
        }
      }
      for (const e of set.extras ?? []) expect(seen.has(e.en), `${set.id} extra ${e.en}`).toBe(false);
      expect(set.cats.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('animal groups: well-known tricky cases', () => {
    const g = (en: string) => catOf('animal-group', en);
    expect(g('whale')).toBe('mamifere');
    expect(g('dolphin')).toBe('mamifere');
    expect(g('bat')).toBe('mamifere');
    expect(g('penguin')).toBe('pasari');
    expect(g('shark')).toBe('pesti');
    expect(g('turtle')).toBe('reptile');
    expect(g('frog')).toBe('amfibieni');
    expect(g('ladybird')).toBe('insecte');
    expect(g('spider')).toBeUndefined();
    expect(CLASS_SETS['animal-group'].extras?.some((t) => t.en === 'spider')).toBe(true);
    expect(CLASS_SETS['animal-group'].cats.find((c) => c.id === 'insecte')?.things.some((t) => ['spider', 'snail', 'scorpion', 'earthworm'].includes(t.en))).toBe(false);
  });

  it('vertebrates: spider, snail, insects are invertebrate; whale, penguin, snake are vertebrate', () => {
    const v = (en: string) => catOf('vertebrate', en);
    for (const x of ['spider', 'snail', 'bee', 'butterfly', 'octopus', 'crab', 'scorpion']) expect(v(x), x).toBe('nevertebrate');
    for (const x of ['whale', 'penguin', 'snake', 'shark', 'frog', 'dog', 'bat']) expect(v(x), x).toBe('vertebrate');
  });

  it('diet, matter, habitat, living, magnet, float, light', () => {
    expect(catOf('diet', 'cow')).toBe('erbivor');
    expect(catOf('diet', 'lion')).toBe('carnivor');
    expect(catOf('diet', 'cat')).toBe('carnivor');
    expect(catOf('diet', 'bear')).toBe('omnivor');
    expect(catOf('matter-state', 'ice')).toBe('solid');
    expect(catOf('matter-state', 'milk')).toBe('lichid');
    expect(catOf('matter-state', 'air')).toBe('gaz');
    expect(catOf('habitat', 'camel')).toBe('desert');
    expect(catOf('habitat', 'dolphin')).toBe('apa');
    expect(catOf('habitat', 'bear')).toBe('padure');
    expect(catOf('living', 'tree')).toBe('viu');
    expect(catOf('living', 'cloud')).toBe('neviu');
    expect(catOf('magnet', 'iron nail')).toBe('atras');
    expect(catOf('magnet', 'aluminium foil')).toBe('neatras');
    expect(catOf('magnet', 'copper wire')).toBe('neatras');
    expect(catOf('float', 'piece of wood')).toBe('pluteste');
    expect(catOf('float', 'coin')).toBe('scufunda');
    expect(catOf('light-source', 'Moon')).toBe('nu');
    expect(catOf('light-source', 'Sun')).toBe('sursa');
    expect(catOf('transparency', 'brick')).toBe('opac');
  });

  it('relations have unique keys and values; sequences have 3-5 distinct steps', () => {
    for (const r of Object.values(RELATIONS)) {
      expect(new Set(r.pairs.map((p) => p.k.ro)).size).toBe(r.pairs.length);
      expect(new Set(r.pairs.map((p) => p.v.ro)).size).toBe(r.pairs.length);
      expect(r.pairs.length).toBeGreaterThanOrEqual(4);
    }
    const young = Object.fromEntries(RELATIONS.young.pairs.map((p) => [p.k.ro, p.v.ro]));
    expect(young).toMatchObject({ oaia: 'mielul', vaca: 'vițelul', calul: 'mânzul', pisica: 'pisoiul' });
    const sense = Object.fromEntries(RELATIONS.sense.pairs.map((p) => [p.k.ro, p.v.ro]));
    expect(sense.ochii).toBe('vedem');
    expect(sense.urechile).toBe('auzim');
    for (const s of Object.values(SEQUENCES)) {
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.steps.length).toBeLessThanOrEqual(5);
      expect(new Set(s.steps.map((x) => x.ro)).size).toBe(s.steps.length);
    }
    expect(SEQUENCES.butterfly.steps.map((s) => s.en)).toEqual(['egg', 'caterpillar', 'pupa (chrysalis)', 'butterfly']);
    expect(SEQUENCES.frog.steps[0].en).toMatch(/eggs/);
    expect(SEQUENCES.seasons.steps[0].en).toBe('spring');
  });

  it('chains start with a plant and end with a carnivore', () => {
    for (const id of ['chain-hare', 'chain-deer', 'chain-owl', 'chain-snake']) {
      const steps = SEQUENCES[id].steps.map((s) => s.en);
      expect(['grass', 'wheat']).toContain(steps[0]);
      expect(['wolf', 'owl', 'snake']).toContain(steps[steps.length - 1]);
    }
  });
});
