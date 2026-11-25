import { describe, it, expect } from 'vitest';
import measuresJson from '../content/skills/mat/measures.json';
import explanationsJson from '../content/explanations/mat/measures.json';
import { getSkillsBySubject } from '../src/engine/content/registry';
import { validateExplanation, validateItem, validateSkill, validateSkillGraph } from '../src/engine/content/validate';
import { checkResponse } from '../src/engine/items/check';
import { generateItems } from '../src/engine/items/generators';
import {
  baniText, daysText, digitalTime, hoursText, leiText, minutesText, moneyText, needsDe, nextHour, roPlural, timeText, weeksText,
} from '../src/engine/items/generators/measureText';
import type { ChoiceItem, FillGapItem, Item, ItemResponse, NumberInputItem, PictureChoiceItem, Skill, VisualSpec } from '../src/engine/types';

const SEED = 777;
const COUNT = 200;
const ids = new Set((measuresJson as { id: string }[]).map((s) => s.id));
const all = getSkillsBySubject('mat');
const skills = all.filter((s) => ids.has(s.id));
const byId = new Map(skills.map((s) => [s.id, s]));
const itemsOf = (id: string): Item[] => generateItems(byId.get(id) as Skill, COUNT, { seed: SEED });

function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
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
    default:
      throw new Error(`unexpected ${item.type}`);
  }
}

const correctText = (it: ChoiceItem) => it.options.find((o) => o.id === it.correctId)?.text?.ro as string;
const sumOf = (v: VisualSpec | undefined) => (v && v.kind === 'money' ? v.amounts.reduce((a, b) => a + b, 0) : NaN);

/** "3 lei și 50 de bani" / "1 leu" / "5 bani" -> bani */
function parseMoney(s: string): number {
  const lei = /(\d+) (?:de )?(?:lei|leu)\b/.exec(s);
  const bani = /(\d+) (?:de )?(?:bani|ban)\b/.exec(s);
  return (lei ? Number(lei[1]) * 100 : 0) + (bani ? Number(bani[1]) : 0);
}

/** all child-facing Romanian strings of an item */
function texts(it: Item): string[] {
  const out = [it.prompt.ro];
  if (it.type === 'choice') out.push(...it.options.map((o) => o.text?.ro ?? ''));
  if (it.type === 'fill-gap') out.push(it.template.ro, ...(it.options ?? []));
  if (it.type === 'order') out.push(...it.cards.map((c) => c.text?.ro ?? ''));
  return out;
}

describe('graph and content files', () => {
  it('adds 14-20 skills for grades I-IV with valid structure', () => {
    expect(skills.length).toBe((measuresJson as unknown[]).length);
    expect(skills.length).toBeGreaterThanOrEqual(14);
    expect(skills.length).toBeLessThanOrEqual(20);
    for (const s of skills) {
      expect(validateSkill(s), s.id).toEqual([]);
      expect(s.grade).toBeGreaterThanOrEqual(1);
      expect(s.grade).toBeLessThanOrEqual(4);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.explanations.length).toBeGreaterThanOrEqual(1);
      expect(s.title.en, s.id).toBeTruthy();
    }
  });

  it('the whole mat graph validates (existing ids only, no cycles, no later-term prerequisites)', () => {
    expect(validateSkillGraph(all)).toEqual([]);
    const mine = skills.flatMap((s) => s.prerequisites);
    for (const p of mine) expect(all.some((x) => x.id === p), p).toBe(true);
  });

  it('every skill has a valid beta ai-draft explanation of 3-4 frames', () => {
    const exps = explanationsJson as { id: string; skillId: string; frames: unknown[]; reviewStatus: string; provenance: { source: string; licence: string } }[];
    expect(exps.length).toBe(skills.length);
    for (const e of exps) {
      expect(validateExplanation(e), e.id).toEqual([]);
      expect(e.frames.length).toBeGreaterThanOrEqual(3);
      expect(e.frames.length).toBeLessThanOrEqual(4);
      expect(e.reviewStatus).toBe('beta');
      expect(e.provenance.source).toBe('ai-draft');
      expect(e.provenance.licence).toBe('OWN');
      expect(byId.get(e.skillId)?.explanations).toContain(e.id);
    }
  });
});

describe('Romanian plural table', () => {
  const table: [number, string][] = [
    [1, '1 leu'], [2, '2 lei'], [5, '5 lei'], [19, '19 lei'], [20, '20 de lei'], [21, '21 de lei'], [50, '50 de lei'],
    [100, '100 de lei'], [101, '101 lei'], [119, '119 lei'], [120, '120 de lei'],
  ];
  it.each(table)('leiText(%i) = %s', (n, expected) => expect(leiText(n).ro).toBe(expected));

  it('bani, ore, minute, zile, săptămâni', () => {
    expect(baniText(1).ro).toBe('1 ban');
    expect(baniText(2).ro).toBe('2 bani');
    expect(baniText(50).ro).toBe('50 de bani');
    expect(baniText(15).ro).toBe('15 bani');
    expect(minutesText(1).ro).toBe('1 minut');
    expect(minutesText(5).ro).toBe('5 minute');
    expect(minutesText(30).ro).toBe('30 de minute');
    expect(hoursText(1).ro).toBe('1 oră');
    expect(hoursText(3).ro).toBe('3 ore');
    expect(hoursText(24).ro).toBe('24 de ore');
    expect(daysText(1).ro).toBe('1 zi');
    expect(daysText(14).ro).toBe('14 zile');
    expect(weeksText(2).ro).toBe('2 săptămâni');
    expect(roPlural(1, 'an', 'ani')).toBe('1 an');
    expect(needsDe(19)).toBe(false);
    expect(needsDe(20)).toBe(true);
  });

  it('English plurals', () => {
    expect(leiText(1).en).toBe('1 leu');
    expect(leiText(2).en).toBe('2 lei');
    expect(baniText(1).en).toBe('1 ban');
    expect(baniText(50).en).toBe('50 bani');
    expect(hoursText(1).en).toBe('1 hour');
    expect(hoursText(2).en).toBe('2 hours');
  });

  it('money phrases', () => {
    expect(moneyText(100).ro).toBe('1 leu');
    expect(moneyText(350).ro).toBe('3 lei și 50 de bani');
    expect(moneyText(105).ro).toBe('1 leu și 5 bani');
    expect(moneyText(201).ro).toBe('2 lei și 1 ban');
    expect(moneyText(50).ro).toBe('50 de bani');
    expect(moneyText(2050).ro).toBe('20 de lei și 50 de bani');
    expect(moneyText(350).en).toBe('3 lei and 50 bani');
  });

  it('clock phrases use one consistent form', () => {
    expect(timeText(3, 0).ro).toBe('ora 3');
    expect(timeText(3, 15).ro).toBe('ora 3 și un sfert');
    expect(timeText(3, 30).ro).toBe('ora 3 și jumătate');
    expect(timeText(3, 45).ro).toBe('ora 4 fără un sfert');
    expect(timeText(12, 45).ro).toBe('ora 1 fără un sfert');
    expect(timeText(2, 20).ro).toBe('ora 2 și 20 de minute');
    expect(timeText(2, 50).ro).toBe('ora 3 fără 10 minute');
    expect(timeText(2, 5).ro).toBe('ora 2 și 5 minute');
    expect(digitalTime(3, 5)).toBe('3:05');
    expect(nextHour(12)).toBe(1);
  });

  it('no generated text breaks number agreement', () => {
    const bad: string[] = [];
    const nouns = 'lei|leu|bani|ban|minute|minut|ore|oră|zile|zi|săptămâni|săptămână|luni|lună|ani|an';
    const re = new RegExp(`(?<![\\d/:])(\\d+)( de)? (${nouns})\\b`, 'g');
    const singular = new Set(['leu', 'ban', 'minut', 'oră', 'zi', 'săptămână', 'lună', 'an']);
    for (const s of skills) {
      for (const it of itemsOf(s.id)) {
        for (const t of texts(it)) {
          for (const m of t.matchAll(re)) {
            const n = Number(m[1]);
            const hasDe = Boolean(m[2]);
            const isSingular = singular.has(m[3]);
            if (n === 1 && !isSingular) bad.push(`${it.id}: "${m[0]}"`);
            else if (n !== 1 && isSingular) bad.push(`${it.id}: "${m[0]}"`);
            else if (n !== 1 && hasDe !== needsDe(n)) bad.push(`${it.id}: "${m[0]}"`);
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

for (const skill of skills) {
  describe(skill.id, () => {
    const items = itemsOf(skill.id);

    it('generates 200 valid items with a passing correct response', () => {
      expect(items).toHaveLength(COUNT);
      for (const it of items) {
        expect(validateItem(it), it.id).toEqual([]);
        expect(it.prompt.en, it.id).toBeTruthy();
        expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
        if (it.type === 'choice' || it.type === 'picture-choice') {
          for (const o of it.options) {
            if (o.id !== it.correctId) expect(checkResponse(it, { type: it.type, selectedId: o.id }), it.id).toBe(false);
          }
        }
        if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct })).toBe(false);
        if (it.type === 'fill-gap' && it.options) {
          for (const o of it.options) if (o !== it.correct) expect(checkResponse(it, { type: 'fill-gap', value: o }), it.id).toBe(false);
        }
      }
    });

    it('options are distinct and ids unique', () => {
      expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
      for (const it of items) {
        if (it.type === 'choice' || it.type === 'picture-choice') {
          expect(new Set(it.options.map((o) => JSON.stringify([o.text, o.visual]))).size, it.id).toBe(it.options.length);
          expect(it.options.length, it.id).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('is deterministic and uses at least 3 item types', () => {
      expect(JSON.stringify(generateItems(skill, 50, { seed: SEED }))).toBe(JSON.stringify(items.slice(0, 50)));
      expect(new Set(items.map((i) => i.type)).size).toBeGreaterThanOrEqual(3);
    });
  });
}

describe('clock correctness', () => {
  const clockSkills = ['mat.clock.hour', 'mat.clock.half', 'mat.clock.quarter', 'mat.clock.minutes'];
  const allowed: Record<string, number[]> = {
    'mat.clock.hour': [0],
    'mat.clock.half': [0, 30],
    'mat.clock.quarter': [0, 15, 30, 45],
    'mat.clock.minutes': [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  };

  for (const id of clockSkills) {
    it(`${id}: the shown time matches the answer`, () => {
      const kinds = new Set<string>();
      for (const it of itemsOf(id)) {
        if (it.visual?.kind === 'clock') {
          const { hours, minutes } = it.visual;
          expect(allowed[id], it.id).toContain(minutes);
          expect(hours).toBeGreaterThanOrEqual(1);
          expect(hours).toBeLessThanOrEqual(12);
        }
        if (it.type === 'choice' && it.prompt.ro === 'Ce oră arată ceasul?' && it.visual?.kind === 'clock') {
          kinds.add('read');
          const { hours, minutes } = it.visual;
          expect([timeText(hours, minutes).ro, digitalTime(hours, minutes)]).toContain(correctText(it));
        }
        if (it.type === 'fill-gap' && it.visual?.kind === 'clock') {
          kinds.add('gap');
          expect(it.correct).toBe(digitalTime(it.visual.hours, it.visual.minutes));
        }
        if (it.type === 'picture-choice') {
          kinds.add('pick');
          const o = it.options.find((x) => x.id === it.correctId)!.visual;
          expect(o.kind).toBe('clock');
          if (o.kind === 'clock') {
            const label = it.prompt.ro.replace(/^Care ceas arată /, '').replace(/\?$/, '');
            expect([timeText(o.hours, o.minutes).ro, digitalTime(o.hours, o.minutes)]).toContain(label);
          }
        }
        if (it.type === 'true-false' && it.visual?.kind === 'clock') {
          kinds.add('tf');
          const { hours, minutes } = it.visual;
          const claim = /ceasul arată (.*)\.$/.exec(it.prompt.ro)![1];
          const isTrue = claim === timeText(hours, minutes).ro || claim === digitalTime(hours, minutes);
          expect(it.correct, it.id).toBe(isTrue);
        }
        if (it.type === 'choice' && it.prompt.ro.includes('peste ') && it.visual?.kind === 'clock') {
          kinds.add('elapsed');
          const m = /peste (o oră|(\d+) (?:de )?(?:minute|ore|ora)|(\d+) ore)/.exec(it.prompt.ro)!;
          const delta = m[1] === 'o oră' ? 60 : /ore/.test(m[1]) ? Number(m[3] ?? m[2]) * 60 : Number(m[2]);
          const start = it.visual.hours * 60 + it.visual.minutes;
          const total = ((((start % 720) + delta) % 720) + 720) % 720;
          const h = Math.floor(total / 60) || 12;
          const mm = total % 60;
          expect([timeText(h, mm).ro, digitalTime(h, mm)], it.id).toContain(correctText(it));
        }
      }
      expect(kinds.size).toBeGreaterThanOrEqual(id === 'mat.clock.hour' ? 4 : 5);
    });
  }

  it('quarter skill covers all four minute values and "peste 30 de minute" style questions', () => {
    const items = itemsOf('mat.clock.quarter');
    const mins = new Set(items.flatMap((i) => (i.visual?.kind === 'clock' ? [i.visual.minutes] : [])));
    expect([...mins].sort()).toEqual([0, 15, 30, 45]);
    expect(items.some((i) => /Ce oră va fi peste \d+ de minute\?/.test(i.prompt.ro))).toBe(true);
  });
});

describe('time units', () => {
  it('hours to minutes and facts are right', () => {
    for (const it of itemsOf('mat.time.hm')) {
      if (it.type === 'fill-gap') {
        const m = /^(\d+) (?:oră|ore) = \{\{gap\}\} min$/.exec(it.template.ro);
        if (m) expect(Number(it.correct)).toBe(Number(m[1]) * 60);
      }
      if (it.type === 'number-input') {
        const d = /începe la ora (\d+) și se termină la ora (\d+)/.exec(it.prompt.ro) ?? /ora (\d+) și se termină la ora (\d+)/.exec(it.prompt.ro);
        if (d) expect(it.correct).toBe(Number(d[2]) - Number(d[1]));
        const h = /în (\d+) ore și jumătate/.exec(it.prompt.ro);
        if (h) expect(it.correct).toBe(Number(h[1]) * 60 + 30);
      }
    }
  });

  it('calendar items: weeks and years multiplication', () => {
    for (const it of itemsOf('mat.time.calendar')) {
      if (it.type === 'number-input') {
        const w = /Câte zile sunt în (\d+) săptămâni\?/.exec(it.prompt.ro);
        if (w) expect(it.correct).toBe(Number(w[1]) * 7);
        const y = /Câte luni sunt în (\d+) ani\?/.exec(it.prompt.ro);
        if (y) expect(it.correct).toBe(Number(y[1]) * 12);
      }
    }
  });
});

describe('money correctness', () => {
  const moneySkills = ['mat.money.recognise', 'mat.money.add', 'mat.money.change', 'mat.money.bani'];

  it('totals, payments, prices and change are arithmetically right', () => {
    for (const id of moneySkills) {
      const counts = { total: 0, pay: 0, sum: 0, change: 0, convert: 0 };
      for (const it of itemsOf(id)) {
        if (it.type === 'choice' && it.prompt.ro.startsWith('Cât fac în total')) {
          counts.total++;
          expect(parseMoney(correctText(it)), it.id).toBe(sumOf(it.visual));
        }
        if (it.type === 'number-input' && /^Câți (lei|bani) sunt în total\?$/.test(it.prompt.ro)) {
          counts.total++;
          const lei = it.prompt.ro.includes('lei');
          expect(it.correct * (lei ? 100 : 1), it.id).toBe(sumOf(it.visual));
        }
        if (it.type === 'picture-choice' && it.prompt.ro.startsWith('Care dintre grupuri face exact')) {
          counts.pay++;
          const price = parseMoney(it.prompt.ro);
          const right = it.options.find((o) => o.id === it.correctId)!.visual;
          expect(sumOf(right), it.id).toBe(price);
          for (const o of it.options) if (o.id !== it.correctId) expect(sumOf(o.visual), it.id).not.toBe(price);
        }
        if (it.type === 'picture-choice' && /mai (mulți|puțini) bani/.test(it.prompt.ro)) {
          const more = it.prompt.ro.includes('mulți');
          const sums = it.options.map((o) => sumOf(o.visual));
          const best = it.options.find((o) => o.id === it.correctId)!.visual;
          expect(sumOf(best), it.id).toBe(more ? Math.max(...sums) : Math.min(...sums));
          expect(new Set(sums).size).toBe(sums.length);
        }
        const change = it.prompt.ro.startsWith('Ana are ') && it.prompt.ro.includes('cumpără') ? it.prompt.ro.split(/ și cumpără /) : undefined;
        if (change) {
          counts.change++;
          const given = parseMoney(change[0]);
          const price = parseMoney(change[1].split('. Cât')[0]);
          expect(given, it.id).toBe(sumOf(it.visual));
          expect(price).toBeLessThan(given);
          if (it.type === 'choice') expect(parseMoney(correctText(it)), it.id).toBe(given - price);
          else expect((it as NumberInputItem).correct * 100, it.id).toBe(given - price);
        }
        const sum = /costă (.+?), iar .+ costă (.+?)\. Cât costă amândouă la un loc\?/.exec(it.prompt.ro);
        if (sum) {
          counts.sum++;
          const total = parseMoney(sum[1]) + parseMoney(sum[2]);
          if (it.type === 'choice') expect(parseMoney(correctText(it)), it.id).toBe(total);
          else expect((it as NumberInputItem).correct * 100, it.id).toBe(total);
        }
        if (it.type === 'fill-gap' && /= \{\{gap\}\} \((bani|lei)\)$/.test(it.template.ro)) {
          counts.convert++;
          const amount = parseMoney(it.template.ro.split('=')[0]);
          expect(Number(it.correct), it.id).toBe(it.template.ro.endsWith('(bani)') ? amount : amount / 100);
        }
        if (it.type === 'number-input' && /^Câți bani sunt în \d/.test(it.prompt.ro)) {
          counts.convert++;
          expect(it.correct, it.id).toBe(parseMoney(it.prompt.ro));
        }
      }
      if (id === 'mat.money.recognise') expect(counts.total).toBeGreaterThan(10);
      if (id === 'mat.money.change') expect(counts.change).toBeGreaterThan(10);
      if (id === 'mat.money.add') expect(counts.sum).toBeGreaterThan(5);
      if (id === 'mat.money.bani') expect(counts.convert).toBeGreaterThan(5);
    }
  });

  it('recognise: whole-lei totals stay within 20 lei and visuals are generic coins/notes', () => {
    for (const it of itemsOf('mat.money.recognise')) {
      if (it.visual?.kind === 'money') {
        expect(sumOf(it.visual)).toBeLessThanOrEqual(2000);
        for (const a of it.visual.amounts) expect([1, 5, 10, 50, 100, 500, 1000]).toContain(a);
      }
    }
  });

  it('bani skill uses amounts with bani and singular forms appear correctly', () => {
    const t = itemsOf('mat.money.bani').flatMap(texts).join('\n');
    expect(t).toMatch(/\d+ de bani|\d+ bani/);
    expect(t).not.toMatch(/\b1 lei\b|\b1 bani\b|\b[2-9] leu\b/);
  });
});

describe('measure correctness', () => {
  const FACTOR: Record<string, number> = { 'm-cm': 100, 'km-m': 1000, 'kg-g': 1000, 'l-ml': 1000 };

  it('rulers, comparisons and conversions are right', () => {
    for (const id of ['mat.length.cm', 'mat.length.m', 'mat.measure.mass.capacity', 'mat.measure.convert']) {
      let conv = 0;
      for (const it of itemsOf(id)) {
        if (it.visual?.kind === 'number-line' && it.visual.jumps?.length === 1) {
          const j = it.visual.jumps[0];
          const len = j.to - j.from;
          const ans = it.type === 'number-input' ? it.correct : Number(correctText(it as ChoiceItem));
          expect(ans, it.id).toBe(len);
          expect(j.to).toBeLessThanOrEqual(it.visual.to);
        }
        if (it.type === 'fill-gap' && it.options?.join() === '<,>,=') {
          const m = /^(\d+) (\w+) \{\{gap\}\} (\d+) (\w+)$/.exec(it.template.ro)!;
          const units: Record<string, number> = { km: 100000, m: 100, cm: 1, kg: 1000, g: 1, l: 1000, ml: 1 };
          const lenFam = ['km', 'm', 'cm'];
          const scale = (u: string) => (lenFam.includes(u) ? units[u] : units[u]);
          const a = Number(m[1]) * scale(m[2]);
          const b = Number(m[3]) * scale(m[4]);
          expect(it.correct, it.id).toBe(a < b ? '<' : a > b ? '>' : '=');
        }
        if (it.type === 'fill-gap' && !it.options?.includes('<')) {
          const down = /^(\d+) (\w+) = \{\{gap\}\} (\w+)$/.exec(it.template.ro);
          if (down) {
            conv++;
            const pair = Object.keys(FACTOR).find((k) => k.startsWith(`${down[2]}-`) && k.endsWith(`-${down[3]}`));
            if (pair) expect(Number(it.correct), it.id).toBe(Number(down[1]) * FACTOR[pair]);
            else {
              const rev = Object.keys(FACTOR).find((k) => k.startsWith(`${down[3]}-`) && k.endsWith(`-${down[2]}`))!;
              expect(Number(it.correct) * FACTOR[rev], it.id).toBe(Number(down[1]));
            }
          }
        }
        if (it.type === 'number-input') {
          const c = /^Transformă în (\w+): (\d+) (\w+) (\d+) \w+\.$/.exec(it.prompt.ro);
          if (c) {
            const pair = Object.keys(FACTOR).find((k) => k === `${c[3]}-${c[1]}`)!;
            expect(it.correct).toBe(Number(c[2]) * FACTOR[pair] + Number(c[4]));
          }
          const add = /^Un (?:șnur|sac) are (\d+) \w+(?: de mere)?, iar altul are (\d+) /.exec(it.prompt.ro);
          if (add) {
            const sub = /^Cu câț?[ie]|Cu câte/.test(it.prompt.ro.split('. ')[1] ?? '');
            expect(it.correct, it.id).toBe(sub ? Math.abs(Number(add[1]) - Number(add[2])) : Number(add[1]) + Number(add[2]));
          }
        }
      }
      if (id === 'mat.measure.convert') expect(conv).toBeGreaterThan(20);
    }
  });

  it('cm skill stays within 20', () => {
    for (const it of itemsOf('mat.length.cm')) {
      if (it.type === 'number-input') expect(it.correct).toBeLessThanOrEqual(20);
    }
  });
});

describe('fraction correctness', () => {
  const NAMED: Record<string, string> = { '1/2': 'o jumătate', '1/4': 'un sfert', '3/4': 'trei sferturi' };

  it('read, pick and tf items match the visual', () => {
    for (const id of ['mat.fraction.half', 'mat.fraction.set', 'mat.fraction.compare']) {
      for (const it of itemsOf(id)) {
        if (it.type === 'choice' && it.visual?.kind === 'fraction') {
          const key = `${it.visual.numerator}/${it.visual.denominator}`;
          expect(correctText(it), it.id).toBe(id === 'mat.fraction.half' ? NAMED[key] : key);
          expect(it.visual.numerator).toBeLessThan(it.visual.denominator);
        }
        if (it.type === 'picture-choice' && /^Care desen are colorat /.test(it.prompt.ro)) {
          const v = it.options.find((o) => o.id === it.correctId)!.visual;
          const label = it.prompt.ro.replace('Care desen are colorat ', '').replace('?', '');
          if (v.kind === 'fraction') {
            const key = `${v.numerator}/${v.denominator}`;
            expect(label, it.id).toBe(id === 'mat.fraction.half' ? NAMED[key] : key);
            const values = it.options.map((o) => (o.visual.kind === 'fraction' ? o.visual.numerator / o.visual.denominator : -1));
            expect(new Set(values).size).toBe(values.length);
          }
        }
        if (it.type === 'true-false' && it.visual?.kind === 'fraction') {
          const key = `${it.visual.numerator}/${it.visual.denominator}`;
          const claim = /are colorat (.*)\.$/.exec(it.prompt.ro)![1];
          const claimed = id === 'mat.fraction.half' ? claim === NAMED[key] : claim === key;
          expect(it.correct, it.id).toBe(claimed);
        }
      }
    }
  });

  it('fractions of a set: objects visual, groups and answers are right', () => {
    const items = itemsOf('mat.fraction.set');
    let n = 0;
    for (const it of items) {
      if (it.visual?.kind === 'objects' && it.visual.groups) {
        n++;
        const frac = /reprezintă (\d+)\/(\d+) din ele/.exec(it.prompt.ro)!;
        const total = it.visual.count;
        expect(total % it.visual.groups).toBe(0);
        expect(it.visual.groups).toBe(Number(frac[2]));
        const expected = (total / Number(frac[2])) * Number(frac[1]);
        if (it.type === 'number-input') expect(it.correct, it.id).toBe(expected);
        else expect(Number(correctText(it as ChoiceItem)), it.id).toBe(expected);
      }
      if (it.type === 'fill-gap') {
        const m = /^(\d+)\/(\d+) din (\d+) = \{\{gap\}\}$/.exec(it.template.ro);
        if (m) expect(Number(it.correct), it.id).toBe((Number(m[3]) / Number(m[2])) * Number(m[1]));
      }
      if (it.type === 'number-input') {
        const w = /^1\/(\d+) dintr-un număr este (\d+)\./.exec(it.prompt.ro);
        if (w) expect(it.correct).toBe(Number(w[1]) * Number(w[2]));
      }
    }
    expect(n).toBeGreaterThan(20);
  });

  it('half skill: halves and quarters of sets, quarters named in Romanian', () => {
    const items = itemsOf('mat.fraction.half');
    for (const it of items) {
      if (it.visual?.kind === 'objects') {
        const m = /reprezintă (o jumătate|un sfert|trei sferturi) din ele/.exec(it.prompt.ro)!;
        const f = m[1] === 'o jumătate' ? [1, 2] : m[1] === 'un sfert' ? [1, 4] : [3, 4];
        const ans = it.type === 'number-input' ? it.correct : Number(correctText(it as ChoiceItem));
        expect(ans, it.id).toBe((it.visual.count / f[1]) * f[0]);
      }
    }
    expect(items.some((i) => i.visual?.kind === 'objects')).toBe(true);
  });

  it('compare: same denominator, correct ordering', () => {
    for (const it of itemsOf('mat.fraction.compare')) {
      if (it.type === 'choice' && /^Care fracție este mai (mare|mică)/.test(it.prompt.ro)) {
        const more = it.prompt.ro.includes('mare');
        const fr = it.options.map((o) => o.text!.ro.split('/').map(Number));
        expect(new Set(fr.map((f) => f[1])).size).toBe(1);
        const best = (correctText(it) as string).split('/').map(Number)[0];
        expect(best, it.id).toBe(more ? Math.max(...fr.map((f) => f[0])) : Math.min(...fr.map((f) => f[0])));
      }
      if (it.type === 'fill-gap') {
        const m = /^(\d+)\/(\d+) \{\{gap\}\} (\d+)\/(\d+)$/.exec(it.template.ro);
        if (m) {
          expect(m[2]).toBe(m[4]);
          expect(it.correct).toBe(Number(m[1]) < Number(m[3]) ? '<' : Number(m[1]) > Number(m[3]) ? '>' : '=');
        }
      }
      if (it.type === 'order') {
        const asc = it.prompt.ro.includes('mică la cea mai mare');
        const nums = it.correctOrder.map((id) => Number(it.cards.find((c) => c.id === id)!.text!.ro.split('/')[0]));
        const sorted = [...nums].sort((a, b) => (asc ? a - b : b - a));
        expect(nums).toEqual(sorted);
      }
      if (it.type === 'picture-choice') {
        const more = it.prompt.ro.includes('mai mare');
        const vals = it.options.map((o) => (o.visual.kind === 'fraction' ? o.visual.numerator : 0));
        const best = it.options.find((o) => o.id === it.correctId)!.visual;
        expect(best.kind === 'fraction' ? best.numerator : -1).toBe(more ? Math.max(...vals) : Math.min(...vals));
      }
    }
  });
});

describe('shapes and perimeter', () => {
  it('perimeter answers equal the sum of the sides', () => {
    let n = 0;
    for (const it of itemsOf('mat.geom.perimeter')) {
      const val = (it: Item) => (it.type === 'number-input' ? it.correct : it.type === 'choice' ? Number(correctText(it)) : NaN);
      const tri = /^Un triunghi are laturile de (\d+) (?:cm|m), (\d+) (?:cm|m) și (\d+) (?:cm|m)\./.exec(it.prompt.ro);
      if (tri) (n++, expect(val(it), it.id).toBe(Number(tri[1]) + Number(tri[2]) + Number(tri[3])));
      const sq = /^Un pătrat are latura de (\d+) (?:cm|m)\./.exec(it.prompt.ro);
      if (sq) (n++, expect(val(it), it.id).toBe(4 * Number(sq[1])));
      const rect = /^Un dreptunghi are lungimea de (\d+) (?:cm|m) și lățimea de (\d+) (?:cm|m)\./.exec(it.prompt.ro);
      if (rect) (n++, expect(val(it), it.id).toBe(2 * (Number(rect[1]) + Number(rect[2]))));
      const sqMissing = /^Perimetrul unui pătrat este (\d+) (?:cm|m)\./.exec(it.prompt.ro);
      if (sqMissing) (n++, expect(val(it), it.id).toBe(Number(sqMissing[1]) / 4));
      const triMissing = /perimetrul de (\d+) (?:cm|m)\. Două laturi au (\d+) (?:cm|m) și (\d+) (?:cm|m)\./.exec(it.prompt.ro);
      if (triMissing) (n++, expect(val(it), it.id).toBe(Number(triMissing[1]) - Number(triMissing[2]) - Number(triMissing[3])));
      const tf = /un pătrat cu latura de (\d+) (?:cm|m) are perimetrul de (\d+) (?:cm|m)/.exec(it.prompt.ro);
      if (tf && it.type === 'true-false') (n++, expect(it.correct, it.id).toBe(Number(tf[2]) === 4 * Number(tf[1])));
    }
    expect(n).toBeGreaterThan(80);
  });

  it('shape facts: sides of triangle/square/rectangle', () => {
    const sides: Record<string, number> = { triunghi: 3, pătrat: 4, dreptunghi: 4 };
    for (const it of itemsOf('mat.geom.shapes')) {
      const m = /^Câte (laturi|colțuri) are un (triunghi|pătrat|dreptunghi)\?$/.exec(it.prompt.ro);
      if (m) {
        const ans = it.type === 'number-input' ? it.correct : Number(correctText(it as ChoiceItem));
        expect(ans, it.id).toBe(sides[m[2]]);
      }
      if (it.type === 'fill-gap') {
        const g = /^Un (triunghi|pătrat|dreptunghi) are \{\{gap\}\}/.exec(it.template.ro);
        if (g) expect(Number((it as FillGapItem).correct)).toBe(sides[g[1]]);
      }
      if (it.type === 'sort') {
        for (const c of it.cards) expect(c.categoryId).toBe(sides[c.text!.ro] === 3 ? 'c3' : 'c4');
      }
      if (it.type === 'choice' && it.prompt.ro.startsWith('Care figură are')) {
        const t = Number(/are (\d) laturi/.exec(it.prompt.ro)![1]);
        expect(sides[correctText(it)], it.id).toBe(t);
        // the question must be unambiguous: no other polygon with the same number of sides is offered
        const others = it.options.filter((o) => o.id !== it.correctId && sides[o.text!.ro] === t);
        expect(others).toEqual([]);
      }
    }
  });
});

describe('visuals are generic', () => {
  it('money visuals only use plain amounts in bani and clock visuals stay on a 12-hour dial', () => {
    for (const s of skills) {
      for (const it of itemsOf(s.id)) {
        const vs: VisualSpec[] = [];
        if (it.visual) vs.push(it.visual);
        if (it.type === 'picture-choice') vs.push(...(it as PictureChoiceItem).options.map((o) => o.visual));
        for (const v of vs) {
          if (v.kind === 'money') for (const a of v.amounts) expect(Number.isInteger(a) && a > 0).toBe(true);
          if (v.kind === 'clock') expect(v.hours >= 1 && v.hours <= 12).toBe(true);
        }
      }
    }
  });
});
