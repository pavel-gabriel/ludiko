import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ITEM_TYPES,
  validateExplanation,
  validateItem,
  validateItems,
  validateSkill,
  validateSkillGraph,
  validateSkills,
  SUBJECT_IDS,
} from '../src/engine/content/validate';
import { validateProvenanceTree } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkill, getSkillsBySubject } from '../src/engine/content/registry';
import type { Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith('.json') ? [p] : [];
  });
}
const readJson = (f: string): unknown => JSON.parse(readFileSync(f, 'utf8'));

/* ---------- fixtures ---------- */

const prov = (id: string, kind = 'item') => ({
  id, kind, title: id, author: 'Ludiko', source: 'own', licence: 'OWN',
});
const t = (ro: string) => ({ ro });
const img = { kind: 'image', src: 'img/x.svg', alt: t('x') };
const aud = { kind: 'audio', src: 'audio/x.mp3', alt: t('x') };

const base = (type: string, extra: Record<string, unknown>) => ({
  id: `i.${type}`, type, skillId: 'mat.count.10', difficulty: 2, prompt: t('Întrebare?'),
  reviewStatus: 'beta', provenance: prov(`p.${type}`), ...extra,
});
const opts = [{ id: 'a', text: t('1') }, { id: 'b', text: t('2') }, { id: 'c', text: t('3') }];

const valid: Record<string, Record<string, unknown>> = {
  choice: base('choice', { options: opts, correctId: 'b' }),
  'picture-choice': base('picture-choice', {
    options: [1, 2].map((n) => ({ id: `o${n}`, visual: { kind: 'objects', icon: '⭐', count: n } })),
    correctId: 'o1',
  }),
  'true-false': base('true-false', { correct: true }),
  'number-input': base('number-input', { correct: 7 }),
  'fill-gap': base('fill-gap', { template: t('{{gap}} + 7 = 15'), options: ['6', '8', '9'], correct: '8' }),
  order: base('order', { cards: opts, correctOrder: ['c', 'a', 'b'] }),
  sort: base('sort', {
    categories: [{ id: 'x', label: t('X') }, { id: 'y', label: t('Y') }],
    cards: [{ id: 'c1', text: t('1'), categoryId: 'x' }, { id: 'c2', text: t('2'), categoryId: 'y' }],
  }),
  match: base('match', {
    pairs: [
      { left: { id: 'l1', text: t('a') }, right: { id: 'r1', text: t('A') } },
      { left: { id: 'l2', text: t('b') }, right: { id: 'r2', text: t('B') } },
    ],
  }),
  hotspot: base('hotspot', {
    image: img,
    regions: [{ id: 'r1', x: 10, y: 20, r: 5 }, { id: 'r2', x: 80, y: 90, r: 10, label: t('Dunărea') }],
    correctId: 'r2',
  }),
  'read-and-answer': base('read-and-answer', {
    passage: t('Ana are o minge.'),
    questions: [
      { ...base('choice', { options: opts, correctId: 'a' }), id: 'q1', provenance: prov('p.q1') },
      { ...base('true-false', { correct: false }), id: 'q2', provenance: prov('p.q2') },
    ],
  }),
  'listen-and-answer': base('listen-and-answer', { audio: aud, options: opts, correctId: 'c' }),
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const withChange = (type: string, change: (o: Record<string, any>) => void) => {
  const o = clone(valid[type]) as Record<string, any>;
  change(o);
  return o;
};
const errs = (o: unknown) => validateItem(o).join('\n');

const skill = (id: string, extra: Record<string, unknown> = {}) => ({
  id, subject: 'mat', grade: 1, semester: 1, competences: [{ programa: 'MEM-2013', code: '1.1' }],
  title: t('Titlu'), prerequisites: [], itemSources: [{ generator: 'counting', params: { max: 10 } }],
  explanations: [], masteryCheck: { items: 5, minCorrect: 4 }, provenance: prov(`prov.${id}`, 'data'), ...extra,
});

const explanation = (extra: Record<string, unknown> = {}) => ({
  id: 'exp.x', title: t('Titlu'), reviewStatus: 'beta', provenance: prov('prov.exp.x', 'explanation'),
  frames: [
    { text: t('Cadrul 1'), visual: { kind: 'number-line', from: 0, to: 10 } },
    { text: t('Cadrul 2'), visual: { kind: 'base10-blocks', tens: 1, ones: 2 } },
    { text: t('Cadrul 3') },
  ],
  ...extra,
});

/* ---------- item validator ---------- */

describe('validateItem', () => {
  it('covers all 11 item types in fixtures', () => {
    expect(Object.keys(valid).sort()).toEqual([...ITEM_TYPES].sort());
  });

  for (const type of ITEM_TYPES) {
    it(`accepts a valid ${type}`, () => {
      expect(validateItem(valid[type])).toEqual([]);
    });
  }

  it('rejects non-objects and unknown types', () => {
    expect(validateItem(null)).not.toEqual([]);
    expect(errs(withChange('choice', (o) => (o.type = 'bogus')))).toMatch(/invalid "type"/);
  });

  it('checks difficulty 1-5, reviewStatus, skillId, prompt, provenance', () => {
    expect(errs(withChange('choice', (o) => (o.difficulty = 0)))).toMatch(/difficulty/);
    expect(errs(withChange('choice', (o) => (o.difficulty = 6)))).toMatch(/difficulty/);
    expect(errs(withChange('choice', (o) => (o.difficulty = 2.5)))).toMatch(/difficulty/);
    expect(errs(withChange('choice', (o) => (o.reviewStatus = 'draft')))).toMatch(/reviewStatus/);
    expect(errs(withChange('choice', (o) => delete o.skillId))).toMatch(/skillId/);
    expect(errs(withChange('choice', (o) => (o.prompt = { en: 'x' })))).toMatch(/Romanian/);
    expect(errs(withChange('choice', (o) => (o.provenance.licence = 'CC-BY-NC-4.0')))).toMatch(/NC\/ND/);
    expect(errs(withChange('choice', (o) => delete o.provenance))).toMatch(/provenance/);
  });

  it('rejects unknown fields', () => {
    expect(errs(withChange('choice', (o) => (o.correct = true)))).toMatch(/unknown field "correct"/);
  });

  it('choice: correctId must exist, ids unique, >= 2 options', () => {
    expect(errs(withChange('choice', (o) => (o.correctId = 'zzz')))).toMatch(/not among the options/);
    expect(errs(withChange('choice', (o) => (o.options[1].id = 'a')))).toMatch(/duplicate id/);
    expect(errs(withChange('choice', (o) => (o.options = [o.options[0]])))).toMatch(/at least 2/);
    expect(errs(withChange('choice', (o) => (o.options[0] = { id: 'a' })))).toMatch(/needs "text" or "visual"/);
  });

  it('picture-choice: every option needs a visual', () => {
    expect(errs(withChange('picture-choice', (o) => delete o.options[1].visual))).toMatch(/need a "visual"/);
    expect(errs(withChange('picture-choice', (o) => (o.correctId = 'nope')))).toMatch(/not among the options/);
  });

  it('true-false / number-input: correct has the right primitive type', () => {
    expect(errs(withChange('true-false', (o) => (o.correct = 'yes')))).toMatch(/boolean/);
    expect(errs(withChange('number-input', (o) => (o.correct = '7')))).toMatch(/number/);
    expect(errs(withChange('number-input', (o) => (o.correct = NaN)))).toMatch(/number/);
  });

  it('fill-gap: exactly one {{gap}}; correct among options', () => {
    expect(errs(withChange('fill-gap', (o) => (o.template.ro = '7 = 15')))).toMatch(/exactly one/);
    expect(errs(withChange('fill-gap', (o) => (o.template.ro = '{{gap}} + {{gap}} = 15')))).toMatch(/exactly one/);
    expect(errs(withChange('fill-gap', (o) => (o.template.en = 'no gap')))).toMatch(/template\.en/);
    expect(errs(withChange('fill-gap', (o) => (o.correct = '99')))).toMatch(/not among the options/);
    expect(errs(withChange('fill-gap', (o) => (o.options = ['8', '8'])))).toMatch(/duplicate option/);
    // options are optional (typed answer)
    expect(errs(withChange('fill-gap', (o) => delete o.options))).toBe('');
  });

  it('order: correctOrder must be a permutation of the card ids', () => {
    expect(errs(withChange('order', (o) => (o.correctOrder = ['a', 'b'])))).toMatch(/missing from correctOrder/);
    expect(errs(withChange('order', (o) => (o.correctOrder = ['a', 'b', 'x'])))).toMatch(/is not a card/);
    expect(errs(withChange('order', (o) => (o.correctOrder = ['a', 'a', 'b', 'c'])))).toMatch(/repeats "a"/);
    expect(errs(withChange('order', (o) => (o.cards[1].id = 'a')))).toMatch(/duplicate id/);
  });

  it('sort: every card has an existing categoryId; category ids unique', () => {
    expect(errs(withChange('sort', (o) => (o.cards[0].categoryId = 'nope')))).toMatch(/does not exist/);
    expect(errs(withChange('sort', (o) => delete o.cards[0].categoryId))).toMatch(/does not exist/);
    expect(errs(withChange('sort', (o) => (o.categories[1].id = 'x')))).toMatch(/duplicate category id/);
    expect(errs(withChange('sort', (o) => (o.categories = [o.categories[0]])))).toMatch(/at least 2/);
  });

  it('match: pair card ids unique across both sides', () => {
    expect(errs(withChange('match', (o) => (o.pairs[1].left.id = 'l1')))).toMatch(/duplicate match card id/);
    expect(errs(withChange('match', (o) => (o.pairs[1].right.id = 'l1')))).toMatch(/duplicate match card id/);
    expect(errs(withChange('match', (o) => (o.pairs = [o.pairs[0]])))).toMatch(/at least 2/);
  });

  it('hotspot: regions within 0-100, correctId exists, image is an image', () => {
    expect(errs(withChange('hotspot', (o) => (o.regions[0].x = 101)))).toMatch(/"x" must be a number within 0-100/);
    expect(errs(withChange('hotspot', (o) => (o.regions[0].y = -1)))).toMatch(/"y"/);
    expect(errs(withChange('hotspot', (o) => (o.regions[0].r = 0)))).toMatch(/"r" must be > 0/);
    expect(errs(withChange('hotspot', (o) => (o.correctId = 'zz')))).toMatch(/not among the options/);
    expect(errs(withChange('hotspot', (o) => (o.regions[1].id = 'r1')))).toMatch(/duplicate region id/);
    expect(errs(withChange('hotspot', (o) => (o.image = aud)))).toMatch(/"kind" must be "image"/);
  });

  it('read-and-answer: sub-questions valid, only choice/true-false, ids unique', () => {
    expect(errs(withChange('read-and-answer', (o) => (o.questions = [])))).toMatch(/non-empty/);
    expect(errs(withChange('read-and-answer', (o) => (o.questions[0].correctId = 'zz')))).toMatch(/not among the options/);
    expect(errs(withChange('read-and-answer', (o) => (o.questions[1].id = 'q1')))).toMatch(/duplicate sub-question id/);
    expect(errs(withChange('read-and-answer', (o) => (o.questions[1] = clone(valid['number-input']))))).toMatch(
      /must be "choice" or "true-false"/,
    );
    expect(errs(withChange('read-and-answer', (o) => delete o.passage))).toMatch(/passage/);
  });

  it('listen-and-answer: audio required and must be audio', () => {
    expect(errs(withChange('listen-and-answer', (o) => delete o.audio))).toMatch(/needs "audio"/);
    expect(errs(withChange('listen-and-answer', (o) => (o.audio = img)))).toMatch(/"kind" must be "audio"/);
  });

  it('validates visual specs', () => {
    const v = (visual: unknown) => errs(withChange('choice', (o) => (o.visual = visual)));
    expect(v({ kind: 'number-line', from: 5, to: 5 })).toMatch(/less than/);
    expect(v({ kind: 'clock', hours: 25, minutes: 0 })).toMatch(/hours/);
    expect(v({ kind: 'objects', icon: '', count: 3 })).toMatch(/icon/);
    expect(v({ kind: 'fraction', numerator: 1, denominator: 0 })).toMatch(/denominator/);
    expect(v({ kind: 'nope' })).toMatch(/invalid visual/);
    expect(v({ kind: 'base10-blocks', tens: 2 })).toBe('');
  });

  it('validateItems reports duplicate item ids', () => {
    const a = clone(valid.choice);
    expect(validateItems([a, clone(a)]).join()).toMatch(/duplicate item id/);
    expect(validateItems([a])).toEqual([]);
  });
});

/* ---------- explanation validator ---------- */

describe('validateExplanation', () => {
  it('accepts a valid explanation', () => {
    expect(validateExplanation(explanation())).toEqual([]);
  });
  it('requires 2-6 frames', () => {
    expect(validateExplanation(explanation({ frames: [{ text: t('x') }] })).join()).toMatch(/2-6 frames/);
    expect(validateExplanation(explanation({ frames: Array(7).fill({ text: t('x') }) })).join()).toMatch(/2-6 frames/);
    expect(validateExplanation(explanation({ frames: Array(6).fill({ text: t('x') }) }))).toEqual([]);
  });
  it('every frame needs ro text and a valid visual', () => {
    expect(validateExplanation(explanation({ frames: [{ text: t('a') }, { text: { en: 'b' } }] })).join()).toMatch(/Romanian/);
    expect(validateExplanation(explanation({ frames: [{ text: t('a') }, { text: t('b'), visual: { kind: 'x' } }] })).join()).toMatch(
      /invalid visual/,
    );
  });
  it('checks id, reviewStatus and provenance', () => {
    expect(validateExplanation(explanation({ id: '' })).join()).toMatch(/missing "id"/);
    expect(validateExplanation(explanation({ reviewStatus: 'x' })).join()).toMatch(/reviewStatus/);
    expect(validateExplanation(explanation({ provenance: undefined })).join()).toMatch(/provenance/);
  });
});

/* ---------- skill validator ---------- */

describe('validateSkill', () => {
  it('accepts a valid skill', () => {
    expect(validateSkill(skill('mat.count.10'))).toEqual([]);
    expect(validateSkill(skill('mat.x.1', { itemSources: [{ bank: 'mat/x.json' }] }))).toEqual([]);
  });
  it('checks id, subject, grade, semester', () => {
    expect(validateSkill(skill('Mat Count')).join()).toMatch(/dot-separated/);
    expect(validateSkill(skill('rom.count.10')).join()).toMatch(/must start with "mat\."/);
    expect(validateSkill(skill('mat.a.b', { subject: 'xx' })).join()).toMatch(/subject/);
    expect(validateSkill(skill('mat.a.b', { grade: 9 })).join()).toMatch(/grade/);
    expect(validateSkill(skill('mat.a.b', { semester: 3 })).join()).toMatch(/semester/);
  });
  it('checks competences, title, prerequisites', () => {
    expect(validateSkill(skill('mat.a.b', { competences: [] })).join()).toMatch(/competences/);
    expect(validateSkill(skill('mat.a.b', { competences: [{ programa: 'MEM-2013' }] })).join()).toMatch(/code/);
    expect(validateSkill(skill('mat.a.b', { title: {} })).join()).toMatch(/Romanian/);
    expect(validateSkill(skill('mat.a.b', { prerequisites: ['mat.a.b'] })).join()).toMatch(/itself/);
    expect(validateSkill(skill('mat.a.b', { prerequisites: ['x.y', 'x.y'] })).join()).toMatch(/duplicate prerequisite/);
  });
  it('checks itemSources', () => {
    expect(validateSkill(skill('mat.a.b', { itemSources: [] })).join()).toMatch(/itemSources/);
    expect(validateSkill(skill('mat.a.b', { itemSources: [{}] })).join()).toMatch(/exactly one/);
    expect(validateSkill(skill('mat.a.b', { itemSources: [{ generator: 'a', bank: 'b' }] })).join()).toMatch(/exactly one/);
  });
  it('checks masteryCheck bounds', () => {
    expect(validateSkill(skill('mat.a.b', { masteryCheck: { items: 3, minCorrect: 4 } })).join()).toMatch(/cannot exceed/);
    expect(validateSkill(skill('mat.a.b', { masteryCheck: { items: 0, minCorrect: 1 } })).join()).toMatch(/items/);
    expect(validateSkill(skill('mat.a.b', { masteryCheck: undefined })).join()).toMatch(/masteryCheck/);
  });
  it('checks provenance and duplicate ids', () => {
    expect(validateSkill(skill('mat.a.b', { provenance: { ...prov('p', 'data'), licence: 'GPL' } })).join()).toMatch(/licence/);
    expect(validateSkills([skill('mat.a.b'), skill('mat.a.b')]).join()).toMatch(/duplicate skill id/);
  });
});

/* ---------- skill graph ---------- */

describe('validateSkillGraph', () => {
  const s = (id: string, prerequisites: string[], grade = 1, semester = 1) =>
    skill(id, { prerequisites, grade, semester }) as unknown as Skill;

  it('accepts a valid DAG across grades', () => {
    expect(validateSkillGraph([s('mat.a', []), s('mat.b', ['mat.a'], 1, 2), s('mat.c', ['mat.b', 'mat.a'], 2, 1)])).toEqual([]);
  });
  it('reports missing prerequisites', () => {
    expect(validateSkillGraph([s('mat.a', ['mat.zzz'])]).join()).toMatch(/"mat.zzz" does not exist/);
  });
  it('reports a cycle with its path', () => {
    const out = validateSkillGraph([s('mat.a', ['mat.c']), s('mat.b', ['mat.a']), s('mat.c', ['mat.b'])]).join();
    expect(out).toMatch(/cycle: mat\.a -> mat\.c -> mat\.b -> mat\.a/);
  });
  it('reports a self-loop', () => {
    expect(validateSkillGraph([s('mat.a', ['mat.a'])]).join()).toMatch(/cycle: mat\.a -> mat\.a/);
  });
  it('rejects a prerequisite from a later grade or semester', () => {
    expect(validateSkillGraph([s('mat.a', ['mat.b'], 1, 1), s('mat.b', [], 2, 1)]).join()).toMatch(/later term/);
    expect(validateSkillGraph([s('mat.a', ['mat.b'], 1, 1), s('mat.b', [], 1, 2)]).join()).toMatch(/later term/);
    // same term is fine
    expect(validateSkillGraph([s('mat.a', ['mat.b'], 1, 1), s('mat.b', [], 1, 1)])).toEqual([]);
  });
});

/* ---------- schemas stay in sync ---------- */

describe('JSON schemas', () => {
  const schema = (n: string) => readJson(join(CONTENT, 'schema', n)) as any;
  it('item.schema.json covers exactly the validator item types', () => {
    const s = schema('item.schema.json');
    const types = s.oneOf.map((r: { $ref: string }) => s.$defs[r.$ref.split('/').pop()!].properties.type.const).sort();
    expect(types).toEqual([...ITEM_TYPES].sort());
  });
  it('skill/explanation/item schemas parse and require provenance', () => {
    expect(schema('skill.schema.json').required).toContain('provenance');
    expect(schema('explanation.schema.json').required).toContain('provenance');
    expect(schema('item.schema.json').$defs.base.required).toContain('provenance');
  });
});

/* ---------- real content ---------- */

describe('content on disk', () => {
  const skillFiles = jsonFiles(join(CONTENT, 'skills'));
  const itemFiles = jsonFiles(join(CONTENT, 'items'));
  const expFiles = jsonFiles(join(CONTENT, 'explanations'));

  const skills = skillFiles.flatMap((f) => readJson(f) as Skill[]);
  const items = itemFiles.flatMap((f) => readJson(f) as { id: string; skillId: string; explanationId?: string }[]);
  const exps = expFiles.flatMap((f) => readJson(f) as { id: string; skillId?: string }[]);

  it('has content files', () => {
    expect(skillFiles.length).toBeGreaterThan(0);
    expect(itemFiles.length).toBeGreaterThan(0);
    expect(expFiles.length).toBeGreaterThan(0);
  });

  it('every skill file is a valid array of skills', () => {
    const errors = skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });
  it('skill ids are unique across files', () => {
    const ids = skills.map((x) => x.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
  it('every item file is a valid array of items', () => {
    const errors = itemFiles.flatMap((f) => validateItems(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });
  it('every explanation is valid', () => {
    const errors = expFiles.flatMap((f) => {
      const data = readJson(f);
      return Array.isArray(data)
        ? data.flatMap((e, i) => validateExplanation(e, `${relative(ROOT, f)}[${i}]`))
        : [`${relative(ROOT, f)}: must be an array`];
    });
    expect(errors).toEqual([]);
  });
  it('item and explanation ids are unique across files', () => {
    expect(items.length).toBe(new Set(items.map((i) => i.id)).size);
    expect(exps.length).toBe(new Set(exps.map((e) => e.id)).size);
  });
  it('provenance ids are unique across all content', () => {
    const seen = new Set<string>();
    const errors = [...skillFiles, ...itemFiles, ...expFiles].flatMap((f) =>
      validateProvenanceTree(readJson(f), relative(ROOT, f), seen),
    );
    expect(errors).toEqual([]);
  });
  it('skill graph is valid', () => {
    expect(validateSkillGraph(skills)).toEqual([]);
  });
  it('every item skillId and explanationId exists', () => {
    const skillIds = new Set(skills.map((x) => x.id));
    const expIds = new Set(exps.map((e) => e.id));
    const errors = items.flatMap((i) => [
      ...(skillIds.has(i.skillId) ? [] : [`item ${i.id}: unknown skillId ${i.skillId}`]),
      ...(i.explanationId && !expIds.has(i.explanationId) ? [`item ${i.id}: unknown explanationId ${i.explanationId}`] : []),
    ]);
    expect(errors).toEqual([]);
  });
  it('every explanation skillId exists and every skill explanation exists', () => {
    const skillIds = new Set(skills.map((x) => x.id));
    const expIds = new Set(exps.map((e) => e.id));
    const errors = [
      ...exps.filter((e) => e.skillId && !skillIds.has(e.skillId)).map((e) => `explanation ${e.id}: unknown skillId ${e.skillId}`),
      ...skills.flatMap((x) => x.explanations.filter((id) => !expIds.has(id)).map((id) => `skill ${x.id}: unknown explanation ${id}`)),
    ];
    expect(errors).toEqual([]);
  });
  it('seed skills follow the content policy (own, OWN, Ludiko, known programa)', () => {
    const programaBySubject: Record<string, string[]> = {
      mat: ['MEM-2013', 'MAT-III-IV-2014', 'MAT-V-VIII-2017'],
      rom: ['CLR-2013', 'LLR-III-IV-2014', 'LLR-V-VIII-2017'],
      stiinte: ['MEM-2013', 'STI-III-IV-2014'],
      civ: ['CIV-III-IV-2014'],
      ist: ['IST-IV-2014', 'IST-V-VIII-2017'],
      geo: ['GEO-IV-2014', 'GEO-V-VIII-2017'],
      logic: ['LUDIKO-LOGIC'],
      bio: ['BIO-V-VIII-2017'],
      fiz: ['FIZ-VI-VIII-2017'],
      chim: ['CHIM-VII-VIII-2017'],
      eng: ['LM1-CP-IV-2013', 'LM1-V-VIII-2017'],
    };
    for (const x of skills) {
      expect(x.provenance.source).toBe('own');
      expect(x.provenance.licence).toBe('OWN');
      expect(x.provenance.author).toBe('Ludiko');
      expect(x.competences.every((c) => programaBySubject[x.subject]?.includes(c.programa))).toBe(true);
      expect(x.title.en).toBeTruthy();
    }
  });
});

/* ---------- registry ---------- */

describe('content registry', () => {
  it('loads the same skills as are on disk', () => {
    const onDisk = jsonFiles(join(CONTENT, 'skills')).flatMap((f) => readJson(f) as Skill[]);
    expect(getAllSkills().map((s) => s.id).sort()).toEqual(onDisk.map((s) => s.id).sort());
  });
  it('looks up skills, grades, items and explanations', () => {
    expect(getSkill('mat.add.carry.20')?.grade).toBe(1);
    expect(getSkill('nope')).toBeUndefined();
    expect(getSkillsBySubject('mat').every((s) => s.subject === 'mat')).toBe(true);
    expect(getSkillsBySubject('rom').every((s) => s.subject === 'rom')).toBe(true);
    expect(SUBJECT_IDS.reduce((n, s) => n + getSkillsBySubject(s).length, 0)).toBe(getAllSkills().length);
    expect(getSkillsBySubject('mat', 0).every((s) => s.grade === 0)).toBe(true);
    expect(getSkillsBySubject('rom').length).toBeGreaterThanOrEqual(18);
    expect(getItemsForSkill('mat.count.20').map((i) => i.type)).toContain('sort');
    expect(getItemsForSkill('mat.sub.10')).toEqual([]);
    expect(getExplanation('exp.add.carry.20')?.frames.length).toBeGreaterThanOrEqual(3);
    expect(getExplanation('nope')).toBeUndefined();
  });
});
