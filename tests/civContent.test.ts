import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItems, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { LEARN_SUBJECTS, subjectEmoji } from '../src/ui/learn/subjects';
import type { CardContent, ChoiceItem, Item, ItemResponse, Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));
const files = (kind: string): string[] => {
  const dir = join(CONTENT, kind, 'civ');
  return existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => join(dir, n)) : [];
};

const civSkills = getSkillsBySubject('civ');
const civItems: Item[] = files('items').flatMap((f) => readJson(f) as Item[]);

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
      return { type: 'read-and-answer', answers: Object.fromEntries(item.questions.map((q) => [q.id, correctResponse(q)])) };
  }
}

const text = (c: CardContent | undefined) => c?.text?.ro ?? '';
/** Romanian text of the correct option(s) of a choice item or of every sub-question */
function correctTexts(item: Item): string[] {
  if (item.type === 'choice') return [text(item.options.find((o) => o.id === item.correctId))];
  if (item.type === 'read-and-answer') return item.questions.flatMap((q) => (q.type === 'choice' ? correctTexts(q) : []));
  return [];
}
const allText = (item: Item): string => JSON.stringify(item);

describe('civ skill graph', () => {
  it('has 20 valid skills, 10 in grade III and 10 in grade IV', () => {
    expect(civSkills).toHaveLength(20);
    expect(civSkills.filter((s) => s.grade === 3)).toHaveLength(10);
    expect(civSkills.filter((s) => s.grade === 4)).toHaveLength(10);
    const errors = files('skills').flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph is a valid DAG and prerequisites stay within the subject', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of civSkills) for (const p of s.prerequisites) expect(p.startsWith('civ.'), `${s.id} -> ${p}`).toBe(true);
    expect(civSkills.filter((s) => s.prerequisites.length === 0).length).toBeLessThanOrEqual(2);
  });

  it('follows the content policy: CIV-III-IV-2014, own, OWN, verify note, English title', () => {
    for (const s of civSkills) {
      expect(s.competences.every((c) => c.programa === 'CIV-III-IV-2014'), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en).toBeTruthy();
    }
  });

  it('is offered in the learner area', () => {
    expect(LEARN_SUBJECTS).toContain('civ');
    expect(subjectEmoji('civ')).toBe('🤝');
  });
});

describe('civ explanations', () => {
  it('every skill has one valid 3-frame beta ai-draft explanation with English text', () => {
    for (const s of civSkills) {
      expect(s.explanations, s.id).toHaveLength(1);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames).toHaveLength(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.title.en).toBeTruthy();
      for (const f of exp?.frames ?? []) {
        expect(f.text.en).toBeTruthy();
        expect(f.visual).toBeDefined();
      }
      expect(validateExplanation(exp)).toEqual([]);
    }
  });
});

describe('civ items', () => {
  it('has about 100 valid items, unique ids, own/ai-draft provenance', () => {
    expect(civItems.length).toBeGreaterThanOrEqual(95);
    expect(civItems.length).toBeLessThanOrEqual(110);
    const errors = files('items').flatMap((f) => validateItems(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
    const ids = civItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of civItems) {
      expect(i.provenance.source).toBe('ai-draft');
      expect(i.provenance.licence).toBe('OWN');
      expect(validateProvenance(i.provenance)).toEqual([]);
      expect(i.prompt.en, i.id).toBeTruthy();
    }
  });

  it('covers choice, true-false, sort, match and 8 read-and-answer stories', () => {
    const count = (t: string) => civItems.filter((i) => i.type === t).length;
    for (const t of ['choice', 'true-false', 'sort', 'match']) expect(count(t), t).toBeGreaterThanOrEqual(8);
    expect(count('read-and-answer')).toBe(8);
  });

  it('every item references an existing civ skill, and every skill has 4-6 items', () => {
    const ids = new Set(civSkills.map((s) => s.id));
    for (const i of civItems) expect(ids.has(i.skillId), i.id).toBe(true);
    for (const s of civSkills) {
      const n = getItemsForSkill(s.id).length;
      expect(n, s.id).toBeGreaterThanOrEqual(4);
      expect(n, s.id).toBeLessThanOrEqual(6);
      expect(n).toBeGreaterThanOrEqual(s.masteryCheck.items);
    }
  });

  it('skills only point at banks that exist', () => {
    for (const s of civSkills as Skill[]) {
      for (const src of s.itemSources) {
        expect('bank' in src && existsSync(join(CONTENT, 'items', src.bank)), s.id).toBe(true);
      }
    }
  });

  it('checkResponse accepts the intended correct answers and rejects wrong ones', () => {
    for (const i of civItems) {
      expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
    }
    for (const i of civItems) {
      if (i.type === 'choice') {
        const wrong = i.options.find((o) => o.id !== i.correctId);
        expect(checkResponse(i, { type: 'choice', selectedId: (wrong as CardContent).id }), i.id).toBe(false);
      }
      if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct }), i.id).toBe(false);
    }
  });

  it('choice items have exactly one correct option and the correct one is not always in the same slot', () => {
    const choices = civItems.filter((i): i is ChoiceItem => i.type === 'choice');
    const slots = new Set(choices.map((i) => i.options.findIndex((o) => o.id === i.correctId)));
    expect(slots.size).toBeGreaterThanOrEqual(3);
  });
});

describe('civ safety facts', () => {
  it('emergency items always say 112 and never mention another emergency number', () => {
    const emergency = civItems.filter((i) => /urgen|incendiu|accident|pompier/i.test(allText(i)));
    expect(emergency.length).toBeGreaterThanOrEqual(2);
    for (const i of emergency) {
      if (i.type === 'choice' && /număr/i.test(i.prompt.ro)) {
        expect(text(i.options.find((o) => o.id === i.correctId)), i.id).toBe('112');
      }
      if (i.type === 'true-false' && /număr/i.test(i.prompt.ro)) {
        expect(i.correct && /112/.test(i.prompt.ro), i.id).toBe(true);
      }
    }
    expect(emergency.some((i) => /112/.test(allText(i)))).toBe(true);
    // every number of 3+ digits in a correct answer or explanation must be 112
    const explanations = civSkills.map((s) => JSON.stringify(getExplanation(s.explanations[0])));
    const correct = civItems.flatMap(correctTexts);
    for (const t of [...explanations, ...correct]) {
      for (const m of t.match(/\b\d{3,}\b/g) ?? []) expect(m, t).toBe('112');
    }
    // the passage of a story that mentions an emergency call uses 112
    for (const i of civItems) {
      if (i.type === 'read-and-answer' && /sun[ăa] la/i.test(i.passage.ro)) expect(i.passage.ro).toContain('112');
    }
    // no other helplines or phone numbers are listed anywhere in civ content
    const everything = JSON.stringify([civItems, ...explanations]);
    expect(everything).not.toMatch(/\b(0800|116\d{3}|0\d{9})\b/);
  });

  it('no item or explanation recommends sharing personal data', () => {
    const sharing = /\b(îi|le) (dau|trimit|spun)\b[^.]*\b(adres|parol|poz|fotografi|telefon)/i;
    for (const i of civItems) {
      for (const t of correctTexts(i)) {
        expect(t, i.id).not.toMatch(sharing);
        expect(t, i.id).not.toMatch(/^(Îi dai|Dai|Trimiți)\b[^.]*(adres|parol|poz|telefon)/i);
      }
    }
    // the internet-safety items teach the rule: tell a trusted adult, never give data
    const net = civItems.filter((i) => i.skillId === 'civ.safety.internet.4');
    expect(net.length).toBeGreaterThanOrEqual(4);
    const joined = net.flatMap(correctTexts).join(' ');
    expect(joined).toMatch(/adult/);
    expect(joined).toMatch(/Nu /);
    const exp = JSON.stringify(getExplanation('exp.civ.safety.internet.4'));
    expect(exp).toMatch(/adult de încredere/);
    expect(exp).toMatch(/Nu dai niciodată/);
  });

  it('the sort item on online talk puts addresses, passwords and photos under "never give"', () => {
    const sort = civItems.find((i) => i.id === 'item.civ.safety.internet.4.03');
    expect(sort?.type).toBe('sort');
    if (sort?.type !== 'sort') return;
    for (const w of ['adresa mea', 'parola', 'poze cu mine']) {
      const card = sort.cards.find((c) => c.text?.ro === w);
      expect(card?.categoryId, w).toBe('nu');
    }
  });
});
