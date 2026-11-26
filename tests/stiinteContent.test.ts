import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { assembleTest, resolveSkills } from '../src/exam/assemble';
import { EN2_MATH } from '../src/exam/blueprints';
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
  it('has valid skills in grades 0-IV (5-7 per grade 0-II, 10+ per grade III-IV)', () => {
    expect(skills.length).toBeGreaterThanOrEqual(40);
    expect(new Set(skills.map((s) => s.grade))).toEqual(new Set([0, 1, 2, 3, 4]));
    for (const g of [0, 1, 2]) {
      const n = getSkillsBySubject('stiinte', g as 0 | 1 | 2).length;
      expect(n, `grade ${g}`).toBeGreaterThanOrEqual(5);
      expect(n, `grade ${g}`).toBeLessThanOrEqual(7);
    }
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

  it('grades 0-II chain into the grade III-IV graph (cross-grade links)', () => {
    const byId = new Map(skills.map((s) => [s.id, s]));
    const younger = new Set(skills.filter((s) => s.grade <= 2).map((s) => s.id));
    // prerequisites of the youngest grades never point forward
    for (const s of skills.filter((x) => x.grade <= 2)) {
      for (const p of s.prerequisites) expect((byId.get(p) as Skill).grade, `${s.id} -> ${p}`).toBeLessThanOrEqual(s.grade);
    }
    const links = (id: string) => (byId.get(id) as Skill).prerequisites.filter((p) => younger.has(p));
    expect(links('stiinte.living')).toEqual(['stiinte.g2.living']);
    expect(links('stiinte.plants.parts')).toEqual(['stiinte.g1.plants']);
    expect(links('stiinte.animals.groups')).toEqual(['stiinte.g1.animals']);
    expect(links('stiinte.animals.young')).toEqual(['stiinte.g1.young']);
    expect(links('stiinte.habitat')).toEqual(['stiinte.g2.habitat']);
    expect(links('stiinte.body.senses')).toEqual(['stiinte.g0.body']);
    expect(links('stiinte.body.hygiene')).toEqual(['stiinte.g1.food']);
    expect(links('stiinte.matter.states')).toEqual(['stiinte.g1.materials', 'stiinte.g1.water']);
    expect(links('stiinte.earth.sunmoon')).toEqual(['stiinte.g2.skysun']);
    expect(links('stiinte.weather')).toEqual(['stiinte.g0.weather']);
    expect(links('stiinte.environment')).toEqual(['stiinte.g2.protect']);
    expect(links('stiinte.lifecycle')).toEqual(['stiinte.g2.lifecycle']);
    expect(links('stiinte.light.sound')).toEqual(['stiinte.g2.light']);
    expect(links('stiinte.magnets')).toEqual(['stiinte.g2.forces']);
    // every grade 0-II skill feeds (directly or not) a grade III-IV skill: nothing is a dead end
    const upstream = new Set<string>();
    const walk = (id: string) => {
      for (const p of (byId.get(id) as Skill).prerequisites) if (!upstream.has(p)) { upstream.add(p); walk(p); }
    };
    for (const s of skills.filter((x) => x.grade >= 3)) walk(s.id);
    for (const id of younger) expect(upstream.has(id), id).toBe(true);
    // grade 0 skills are the roots of the whole subject
    for (const s of skills.filter((x) => x.grade === 0)) {
      expect(s.prerequisites.every((p) => (byId.get(p) as Skill).grade === 0), s.id).toBe(true);
    }
  });

  it('uses MEM-2013 for grades 0-II and STI-III-IV-2014 above (codes to verify), own provenance, English titles', () => {
    for (const s of skills) {
      const programa = s.grade <= 2 ? 'MEM-2013' : 'STI-III-IV-2014';
      expect(s.competences.length, s.id).toBeGreaterThan(0);
      expect(s.competences.every((c) => c.programa === programa), s.id).toBe(true);
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

describe('stiinte grades 0-II banks', () => {
  const young = new Set(skills.filter((s) => s.grade <= 2).map((s) => s.id));
  const items = jsonFiles(join(CONTENT, 'items', 'stiinte'))
    .filter((f) => /grade[012]\.json$/.test(f))
    .flatMap((f) => readJson(f) as Item[]);

  it('has 50+ valid items on grade 0-II skills, with grade II read-and-answer texts', () => {
    expect(items.length).toBeGreaterThanOrEqual(50);
    for (const it of items) {
      expect(young.has(it.skillId), it.id).toBe(true);
      expect(validateItem(it), it.id).toEqual([]);
    }
    const reads = items.filter((i) => i.type === 'read-and-answer');
    expect(reads.length).toBeGreaterThanOrEqual(3);
    for (const r of reads) expect(getSkill(r.skillId)?.grade).toBe(2);
  });

  it('every grade 0-II skill has at least 3 bank items', () => {
    for (const id of young) expect(items.filter((i) => i.skillId === id).length, id).toBeGreaterThanOrEqual(3);
  });

  it('the pre-reader level is picture-led: grade 0 choice options carry an emoji visual', () => {
    const g0 = items.filter((i) => getSkill(i.skillId)?.grade === 0 && i.type === 'choice');
    expect(g0.length).toBeGreaterThanOrEqual(8);
    for (const it of g0) if (it.type === 'choice') expect(it.options.every((o) => o.visual), it.id).toBe(true);
  });
});

describe('EN II test 2 environment section', () => {
  it('selects grade 1-2 stiinte skills and is no longer skipped', () => {
    const part = EN2_MATH.sections.find((s) => s.id === 'environment')?.parts[0];
    expect(part).toBeDefined();
    const selected = resolveSkills((part as NonNullable<typeof part>).skills);
    expect(selected.length).toBeGreaterThanOrEqual(10);
    expect(new Set(selected.map((s) => s.grade))).toEqual(new Set([1, 2]));
    for (const seed of [1, 2, 3, 4, 5]) {
      const env = assembleTest(EN2_MATH, { seed }).sections.find((s) => s.id === 'environment');
      expect(env, `seed ${seed}`).toBeDefined();
      expect((env as NonNullable<typeof env>).items.length).toBe(4);
      for (const it of (env as NonNullable<typeof env>).items) {
        expect(getSkill(it.skillId)?.subject).toBe('stiinte');
        expect([1, 2]).toContain(getSkill(it.skillId)?.grade);
        expect(EN2_MATH.allowedTypes).toContain(it.type);
      }
    }
  });
});

describe('stiinte generators', () => {
  const genSkills = skills.filter((s) => s.itemSources.some((x) => 'generator' in x));

  it('most skills use generators (all of grades 0-II)', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(33);
    for (const s of skills.filter((x) => x.grade <= 2)) expect(genSkills.includes(s), s.id).toBe(true);
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

  it('grades 0-II facts: unambiguous and correct', () => {
    const cases: [string, string, string][] = [
      ['plant-animal', 'butterfly', 'animal'], ['plant-animal', 'cactus', 'planta'],
      ['season', 'snowman', 'iarna'], ['season', 'watermelon', 'vara'], ['season', 'yellow leaf', 'toamna'], ['season', 'tulip', 'primavara'],
      ['day-night', 'Sun', 'zi'], ['day-night', 'star', 'noapte'],
      ['weather-wear', 'umbrella', 'ploaie'], ['weather-wear', 'sunglasses', 'soare'], ['weather-wear', 'scarf', 'frig'],
      ['plant-eaten', 'carrot', 'radacina'], ['plant-eaten', 'lettuce', 'frunza'], ['plant-eaten', 'apple', 'fructul'],
      ['domestic-wild', 'cow', 'domestic'], ['domestic-wild', 'wolf', 'salbatic'],
      ['healthy-food', 'apple', 'sanatos'], ['healthy-food', 'lollipop', 'rar'],
      ['material', 'metal key', 'metal'], ['material', 'glass jar', 'sticla'], ['material', 'wooden spoon', 'lemn'], ['material', 'plastic bucket', 'plastic'],
      ['water-form', 'ice', 'inghetata'], ['water-form', 'river', 'lichida'],
      ['habitat-simple', 'carp', 'apa'], ['habitat-simple', 'hen', 'ferma'], ['habitat-simple', 'squirrel', 'padure'],
      ['push-pull', 'kicking a ball', 'impinge'], ['push-pull', 'closing a drawer', 'impinge'], ['push-pull', 'opening a drawer', 'trage'],
      ['shadow', 'tree', 'umbra'], ['shadow', 'clean window pane', 'nu'],
      ['plant-needs', 'water', 'trebuie'], ['plant-needs', 'television', 'nu'],
      ['eco-actions', 'planting a tree', 'bine'], ['eco-actions', 'letting water run for nothing', 'rau'],
    ];
    for (const [set, en, cat] of cases) expect(catOf(set, en), `${set}/${en}`).toBe(cat);
    const young = Object.fromEntries(RELATIONS['young-easy'].pairs.map((p) => [p.k.ro, p.v.ro]));
    expect(young).toMatchObject({ oaia: 'mielul', vaca: 'vițelul', pisica: 'pisoiul', câinele: 'cățelul', calul: 'mânzul' });
    const body = Object.fromEntries(RELATIONS['body-easy'].pairs.map((p) => [p.k.ro, p.v.ro]));
    expect(body).toMatchObject({ ochii: 'vedem', urechile: 'auzim', nasul: 'mirosim', picioarele: 'mergem' });
    expect(RELATIONS.sky.pairs.find((p) => p.k.ro === 'Soarele')?.v.ro).toMatch(/lumină și căldură/);
    expect(RELATIONS.sky.pairs.find((p) => p.k.ro === 'Luna')?.v.ro).toMatch(/nu are lumină proprie/);
    expect(SEQUENCES.day.steps.map((s) => s.en)).toEqual(['morning', 'midday', 'evening', 'night']);
    expect(SEQUENCES['human-life'].steps.map((s) => s.en)).toEqual(['baby', 'child', 'adult', 'grandfather']);
  });

  it('chains start with a plant and end with a carnivore', () => {
    for (const id of ['chain-hare', 'chain-deer', 'chain-owl', 'chain-snake']) {
      const steps = SEQUENCES[id].steps.map((s) => s.en);
      expect(['grass', 'wheat']).toContain(steps[0]);
      expect(['wolf', 'owl', 'snake']).toContain(steps[steps.length - 1]);
    }
  });
});
