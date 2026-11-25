/**
 * Structural + semantic validators for content records (skills, items, explanations).
 * Hand-written (no dependencies), same style as provenance.ts. Every validator returns a
 * list of human-readable errors; an empty list means valid.
 * JSON Schemas in content/schema/ describe the same shapes for external tooling.
 */
import { validateProvenance } from './provenance';
import type { Skill } from '../types';

export const ITEM_TYPES = [
  'choice',
  'picture-choice',
  'true-false',
  'number-input',
  'fill-gap',
  'order',
  'sort',
  'match',
  'hotspot',
  'read-and-answer',
  'listen-and-answer',
] as const;

export const SUBJECT_IDS = ['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic'] as const;
export const REVIEW_STATUSES = ['auto-checked', 'beta', 'reviewed'] as const;
export const VISUAL_KINDS = ['number-line', 'base10-blocks', 'clock', 'money', 'objects', 'fraction', 'shape', 'ruler', 'image'] as const;

const SHAPE_SIDE_COUNTS: Record<string, number[]> = { triangle: [3], square: [1, 4], rectangle: [2, 4], circle: [] };

export const GAP_MARKER = '{{gap}}';
export const MIN_FRAMES = 2;
export const MAX_FRAMES = 6;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v);

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

function unknownFields(o: Obj, allowed: readonly string[], where: string): string[] {
  return Object.keys(o)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${where}: unknown field "${k}"`);
}

/* ------------------------------------------------------------------ */
/*  Shared building blocks                                            */
/* ------------------------------------------------------------------ */

export function validateLocalizedText(v: unknown, where: string): string[] {
  if (!isObj(v)) return [`${where}: must be an object { ro, en? }`];
  const errors = unknownFields(v, ['ro', 'en'], where);
  if (!isNonEmpty(v.ro)) errors.push(`${where}: missing Romanian text "ro"`);
  if (v.en !== undefined && typeof v.en !== 'string') errors.push(`${where}: "en" must be a string`);
  return errors;
}

export function validateMediaRef(v: unknown, where: string, expectedKind?: 'image' | 'audio'): string[] {
  if (!isObj(v)) return [`${where}: must be a media object`];
  const errors = unknownFields(v, ['kind', 'src', 'alt', 'provenanceId'], where);
  if (v.kind !== 'image' && v.kind !== 'audio') errors.push(`${where}: "kind" must be "image" or "audio"`);
  else if (expectedKind && v.kind !== expectedKind) errors.push(`${where}: "kind" must be "${expectedKind}"`);
  if (!isNonEmpty(v.src)) errors.push(`${where}: missing "src"`);
  errors.push(...validateLocalizedText(v.alt, `${where}.alt`));
  if (v.provenanceId !== undefined && !isNonEmpty(v.provenanceId)) {
    errors.push(`${where}: "provenanceId" must be a non-empty string`);
  }
  return errors;
}

export function validateVisual(v: unknown, where: string): string[] {
  if (!isObj(v)) return [`${where}: must be a visual spec object`];
  const errors: string[] = [];
  const fields = (allowed: string[]) => errors.push(...unknownFields(v, ['kind', ...allowed], where));
  const optInt = (k: string, min: number) => {
    if (v[k] !== undefined && !(isInt(v[k]) && (v[k] as number) >= min)) {
      errors.push(`${where}: "${k}" must be an integer >= ${min}`);
    }
  };
  switch (v.kind) {
    case 'number-line': {
      fields(['from', 'to', 'step', 'marks', 'jumps']);
      if (!isNum(v.from) || !isNum(v.to)) errors.push(`${where}: "from" and "to" must be numbers`);
      else if (v.from >= v.to) errors.push(`${where}: "from" must be less than "to"`);
      if (v.step !== undefined && !(isNum(v.step) && v.step > 0)) errors.push(`${where}: "step" must be > 0`);
      if (v.marks !== undefined && !(Array.isArray(v.marks) && v.marks.every(isNum))) {
        errors.push(`${where}: "marks" must be an array of numbers`);
      }
      if (v.jumps !== undefined) {
        if (!Array.isArray(v.jumps)) errors.push(`${where}: "jumps" must be an array`);
        else {
          v.jumps.forEach((j, i) => {
            if (!isObj(j) || !isNum(j.from) || !isNum(j.to)) {
              errors.push(`${where}.jumps[${i}]: must be { from: number, to: number }`);
            }
          });
        }
      }
      break;
    }
    case 'base10-blocks':
      fields(['hundreds', 'tens', 'ones']);
      optInt('hundreds', 0);
      optInt('tens', 0);
      optInt('ones', 0);
      break;
    case 'clock':
      fields(['hours', 'minutes']);
      if (!isInt(v.hours) || v.hours < 0 || v.hours > 23) errors.push(`${where}: "hours" must be an integer 0-23`);
      if (!isInt(v.minutes) || v.minutes < 0 || v.minutes > 59) errors.push(`${where}: "minutes" must be an integer 0-59`);
      break;
    case 'money':
      fields(['amounts']);
      if (!Array.isArray(v.amounts) || v.amounts.length === 0 || !v.amounts.every((a) => isInt(a) && a > 0)) {
        errors.push(`${where}: "amounts" must be a non-empty array of positive integers (bani)`);
      }
      break;
    case 'objects':
      fields(['icon', 'count', 'groups']);
      if (!isNonEmpty(v.icon)) errors.push(`${where}: missing "icon"`);
      if (!isInt(v.count) || v.count < 0) errors.push(`${where}: "count" must be an integer >= 0`);
      optInt('groups', 1);
      break;
    case 'fraction':
      fields(['numerator', 'denominator', 'shape']);
      if (!isInt(v.numerator) || v.numerator < 0) errors.push(`${where}: "numerator" must be an integer >= 0`);
      if (!isInt(v.denominator) || v.denominator < 1) errors.push(`${where}: "denominator" must be an integer >= 1`);
      if (v.shape !== undefined && v.shape !== 'circle' && v.shape !== 'bar') {
        errors.push(`${where}: "shape" must be "circle" or "bar"`);
      }
      break;
    case 'shape': {
      fields(['shape', 'sides', 'unit', 'hideSide']);
      const shape = v.shape as string;
      if (typeof shape !== 'string' || !(shape in SHAPE_SIDE_COUNTS)) {
        errors.push(`${where}: "shape" must be one of ${Object.keys(SHAPE_SIDE_COUNTS).join(', ')}`);
        break;
      }
      const allowed = SHAPE_SIDE_COUNTS[shape];
      if (v.sides !== undefined) {
        if (!Array.isArray(v.sides) || !v.sides.every((s) => isNum(s) && s > 0)) {
          errors.push(`${where}: "sides" must be an array of positive numbers`);
        } else if (!allowed.includes(v.sides.length)) {
          errors.push(
            allowed.length
              ? `${where}: a ${shape} needs ${allowed.join(' or ')} side value(s), got ${v.sides.length}`
              : `${where}: a circle has no "sides"`,
          );
        }
      }
      if (v.unit !== undefined && !isNonEmpty(v.unit)) errors.push(`${where}: "unit" must be a non-empty string`);
      if (v.hideSide !== undefined) {
        const n = Array.isArray(v.sides) ? v.sides.length : 0;
        if (!isInt(v.hideSide) || v.hideSide < 0 || v.hideSide >= n) {
          errors.push(`${where}: "hideSide" must be an index into "sides" (0-${Math.max(0, n - 1)})`);
        }
      }
      break;
    }
    case 'ruler': {
      fields(['to', 'unit', 'from', 'objectEnd', 'objectLabel']);
      if (!isInt(v.to) || v.to < 1 || v.to > 100) errors.push(`${where}: "to" must be an integer 1-100`);
      if (v.unit !== 'cm' && v.unit !== 'm') errors.push(`${where}: "unit" must be "cm" or "m"`);
      if (v.from !== undefined && !(isNum(v.from) && v.from >= 0)) errors.push(`${where}: "from" must be a number >= 0`);
      if (v.objectEnd !== undefined) {
        const from = isNum(v.from) ? v.from : 0;
        if (!isNum(v.objectEnd)) errors.push(`${where}: "objectEnd" must be a number`);
        else {
          if (v.objectEnd <= from) errors.push(`${where}: "from" must be less than "objectEnd"`);
          if (isNum(v.to) && v.objectEnd > v.to) errors.push(`${where}: "objectEnd" must not exceed "to"`);
        }
      } else if (v.from !== undefined) errors.push(`${where}: "from" needs "objectEnd"`);
      if (v.objectLabel !== undefined) errors.push(...validateLocalizedText(v.objectLabel, `${where}.objectLabel`));
      break;
    }
    case 'image':
      fields(['media']);
      errors.push(...validateMediaRef(v.media, `${where}.media`, 'image'));
      break;
    default:
      errors.push(`${where}: invalid visual "kind" ${JSON.stringify(v.kind)}`);
  }
  return errors;
}

function validateCard(v: unknown, where: string, opts: { requireVisual?: boolean; extra?: string[] } = {}): string[] {
  if (!isObj(v)) return [`${where}: must be an object`];
  const errors = unknownFields(v, ['id', 'text', 'visual', ...(opts.extra ?? [])], where);
  if (!isNonEmpty(v.id)) errors.push(`${where}: missing "id"`);
  if (v.text !== undefined) errors.push(...validateLocalizedText(v.text, `${where}.text`));
  if (v.visual !== undefined) errors.push(...validateVisual(v.visual, `${where}.visual`));
  if (v.text === undefined && v.visual === undefined) errors.push(`${where}: needs "text" or "visual"`);
  if (opts.requireVisual && v.visual === undefined) errors.push(`${where}: picture-choice options need a "visual"`);
  return errors;
}

function validateCards(
  cards: unknown,
  where: string,
  opts: { min: number; requireVisual?: boolean; extra?: string[] },
): string[] {
  if (!Array.isArray(cards) || cards.length < opts.min) {
    return [`${where}: must be an array of at least ${opts.min} entries`];
  }
  const errors = cards.flatMap((c, i) => validateCard(c, `${where}[${i}]`, opts));
  const ids = cards.filter(isObj).map((c) => c.id).filter(isNonEmpty);
  for (const d of duplicates(ids)) errors.push(`${where}: duplicate id "${d}"`);
  return errors;
}

function cardIds(cards: unknown): string[] {
  return Array.isArray(cards) ? cards.filter(isObj).map((c) => c.id).filter(isNonEmpty) : [];
}

/* ------------------------------------------------------------------ */
/*  Items                                                             */
/* ------------------------------------------------------------------ */

const BASE_FIELDS = [
  'id', 'type', 'skillId', 'difficulty', 'prompt', 'visual', 'audio', 'explanationId', 'reviewStatus', 'provenance',
];

const TYPE_FIELDS: Record<(typeof ITEM_TYPES)[number], string[]> = {
  choice: ['options', 'correctId'],
  'picture-choice': ['options', 'correctId'],
  'true-false': ['correct'],
  'number-input': ['correct'],
  'fill-gap': ['template', 'options', 'correct'],
  order: ['cards', 'correctOrder'],
  sort: ['categories', 'cards'],
  match: ['pairs'],
  hotspot: ['image', 'regions', 'correctId'],
  'read-and-answer': ['passage', 'questions'],
  'listen-and-answer': ['options', 'correctId'],
};

function validateCorrectId(item: Obj, ids: string[], where: string): string[] {
  if (!isNonEmpty(item.correctId)) return [`${where}: missing "correctId"`];
  return ids.includes(item.correctId) ? [] : [`${where}: correctId "${item.correctId}" is not among the options`];
}

export function validateItem(item: unknown, where = 'item'): string[] {
  if (!isObj(item)) return [`${where}: must be an object`];
  const label = `${where}${isNonEmpty(item.id) ? ` (${item.id})` : ''}`;
  const errors: string[] = [];

  if (!isNonEmpty(item.id)) errors.push(`${label}: missing "id"`);
  if (!isNonEmpty(item.skillId)) errors.push(`${label}: missing "skillId"`);
  if (!isInt(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) {
    errors.push(`${label}: "difficulty" must be an integer 1-5`);
  }
  if (!REVIEW_STATUSES.includes(item.reviewStatus as never)) {
    errors.push(`${label}: invalid "reviewStatus" ${JSON.stringify(item.reviewStatus)}`);
  }
  errors.push(...validateLocalizedText(item.prompt, `${label}.prompt`));
  if (item.visual !== undefined) errors.push(...validateVisual(item.visual, `${label}.visual`));
  if (item.audio !== undefined) errors.push(...validateMediaRef(item.audio, `${label}.audio`, 'audio'));
  if (item.explanationId !== undefined && !isNonEmpty(item.explanationId)) {
    errors.push(`${label}: "explanationId" must be a non-empty string`);
  }
  errors.push(...validateProvenance(item.provenance, `${label}.provenance`));

  const type = item.type as (typeof ITEM_TYPES)[number];
  if (!ITEM_TYPES.includes(type)) {
    errors.push(`${label}: invalid "type" ${JSON.stringify(item.type)}`);
    return errors;
  }
  errors.push(...unknownFields(item, [...BASE_FIELDS, ...TYPE_FIELDS[type]], label));

  switch (type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer': {
      errors.push(
        ...validateCards(item.options, `${label}.options`, { min: 2, requireVisual: type === 'picture-choice' }),
      );
      errors.push(...validateCorrectId(item, cardIds(item.options), label));
      if (type === 'listen-and-answer') {
        if (item.audio === undefined) errors.push(`${label}: listen-and-answer needs "audio"`);
      }
      break;
    }
    case 'true-false':
      if (typeof item.correct !== 'boolean') errors.push(`${label}: "correct" must be a boolean`);
      break;
    case 'number-input':
      if (!isNum(item.correct)) errors.push(`${label}: "correct" must be a number`);
      break;
    case 'fill-gap': {
      const t = item.template;
      errors.push(...validateLocalizedText(t, `${label}.template`));
      if (isObj(t)) {
        for (const lang of ['ro', 'en'] as const) {
          const s = t[lang];
          if (typeof s === 'string' && s.split(GAP_MARKER).length - 1 !== 1) {
            errors.push(`${label}: template.${lang} must contain exactly one "${GAP_MARKER}"`);
          }
        }
      }
      if (!isNonEmpty(item.correct)) errors.push(`${label}: "correct" must be a non-empty string`);
      if (item.options !== undefined) {
        const o = item.options;
        if (!Array.isArray(o) || o.length < 2 || !o.every(isNonEmpty)) {
          errors.push(`${label}: "options" must be an array of at least 2 non-empty strings`);
        } else {
          for (const d of duplicates(o as string[])) errors.push(`${label}: duplicate option "${d}"`);
          if (isNonEmpty(item.correct) && !o.includes(item.correct)) {
            errors.push(`${label}: correct answer "${item.correct}" is not among the options`);
          }
        }
      }
      break;
    }
    case 'order': {
      errors.push(...validateCards(item.cards, `${label}.cards`, { min: 2 }));
      const ids = cardIds(item.cards);
      const order = item.correctOrder;
      if (!Array.isArray(order) || !order.every(isNonEmpty)) {
        errors.push(`${label}: "correctOrder" must be an array of card ids`);
      } else {
        const orderIds = order as string[];
        for (const d of duplicates(orderIds)) errors.push(`${label}: correctOrder repeats "${d}"`);
        for (const id of orderIds) if (!ids.includes(id)) errors.push(`${label}: correctOrder id "${id}" is not a card`);
        for (const id of ids) if (!orderIds.includes(id)) errors.push(`${label}: card "${id}" missing from correctOrder`);
      }
      break;
    }
    case 'sort': {
      const cats = item.categories;
      let catIds: string[] = [];
      if (!Array.isArray(cats) || cats.length < 2) {
        errors.push(`${label}: "categories" must be an array of at least 2 entries`);
      } else {
        cats.forEach((c, i) => {
          if (!isObj(c) || !isNonEmpty(c.id)) errors.push(`${label}.categories[${i}]: missing "id"`);
          else {
            errors.push(...unknownFields(c, ['id', 'label'], `${label}.categories[${i}]`));
            errors.push(...validateLocalizedText(c.label, `${label}.categories[${i}].label`));
          }
        });
        catIds = cats.filter(isObj).map((c) => c.id).filter(isNonEmpty);
        for (const d of duplicates(catIds)) errors.push(`${label}: duplicate category id "${d}"`);
      }
      errors.push(...validateCards(item.cards, `${label}.cards`, { min: 2, extra: ['categoryId'] }));
      if (Array.isArray(item.cards)) {
        item.cards.forEach((c, i) => {
          if (isObj(c) && !catIds.includes(c.categoryId as string)) {
            errors.push(`${label}.cards[${i}]: categoryId ${JSON.stringify(c.categoryId)} does not exist`);
          }
        });
      }
      break;
    }
    case 'match': {
      const pairs = item.pairs;
      if (!Array.isArray(pairs) || pairs.length < 2) {
        errors.push(`${label}: "pairs" must be an array of at least 2 entries`);
        break;
      }
      const ids: string[] = [];
      pairs.forEach((p, i) => {
        if (!isObj(p)) return errors.push(`${label}.pairs[${i}]: must be { left, right }`);
        errors.push(...unknownFields(p, ['left', 'right'], `${label}.pairs[${i}]`));
        for (const side of ['left', 'right'] as const) {
          errors.push(...validateCard(p[side], `${label}.pairs[${i}].${side}`));
          if (isObj(p[side]) && isNonEmpty((p[side] as Obj).id)) ids.push((p[side] as Obj).id as string);
        }
      });
      for (const d of duplicates(ids)) errors.push(`${label}: duplicate match card id "${d}"`);
      break;
    }
    case 'hotspot': {
      errors.push(...validateMediaRef(item.image, `${label}.image`, 'image'));
      const regions = item.regions;
      if (!Array.isArray(regions) || regions.length < 2) {
        errors.push(`${label}: "regions" must be an array of at least 2 entries`);
        break;
      }
      regions.forEach((r, i) => {
        const w = `${label}.regions[${i}]`;
        if (!isObj(r)) return errors.push(`${w}: must be an object`);
        errors.push(...unknownFields(r, ['id', 'x', 'y', 'r', 'label'], w));
        if (!isNonEmpty(r.id)) errors.push(`${w}: missing "id"`);
        for (const k of ['x', 'y', 'r'] as const) {
          if (!isNum(r[k]) || r[k] < 0 || r[k] > 100) errors.push(`${w}: "${k}" must be a number within 0-100`);
        }
        if (isNum(r.r) && r.r === 0) errors.push(`${w}: "r" must be > 0`);
        if (r.label !== undefined) errors.push(...validateLocalizedText(r.label, `${w}.label`));
      });
      const ids = regions.filter(isObj).map((r) => r.id).filter(isNonEmpty);
      for (const d of duplicates(ids)) errors.push(`${label}: duplicate region id "${d}"`);
      errors.push(...validateCorrectId(item, ids, label));
      break;
    }
    case 'read-and-answer': {
      errors.push(...validateLocalizedText(item.passage, `${label}.passage`));
      const qs = item.questions;
      if (!Array.isArray(qs) || qs.length === 0) {
        errors.push(`${label}: "questions" must be a non-empty array`);
        break;
      }
      qs.forEach((q, i) => {
        const w = `${label}.questions[${i}]`;
        if (isObj(q) && q.type !== 'choice' && q.type !== 'true-false') {
          errors.push(`${w}: sub-question type must be "choice" or "true-false"`);
        } else errors.push(...validateItem(q, w));
      });
      const ids = qs.filter(isObj).map((q) => q.id).filter(isNonEmpty);
      for (const d of duplicates(ids)) errors.push(`${label}: duplicate sub-question id "${d}"`);
      if (isNonEmpty(item.id) && ids.includes(item.id)) errors.push(`${label}: sub-question reuses the parent id`);
      break;
    }
  }
  return errors;
}

/** Validate a list of items and report duplicate ids across the list. */
export function validateItems(items: unknown, where = 'items'): string[] {
  if (!Array.isArray(items)) return [`${where}: must be an array`];
  const errors = items.flatMap((it, i) => validateItem(it, `${where}[${i}]`));
  const ids = items.filter(isObj).map((i) => i.id).filter(isNonEmpty);
  for (const d of duplicates(ids)) errors.push(`${where}: duplicate item id "${d}"`);
  return errors;
}

/* ------------------------------------------------------------------ */
/*  Explanations                                                      */
/* ------------------------------------------------------------------ */

export function validateExplanation(exp: unknown, where = 'explanation'): string[] {
  if (!isObj(exp)) return [`${where}: must be an object`];
  const label = `${where}${isNonEmpty(exp.id) ? ` (${exp.id})` : ''}`;
  const errors = unknownFields(exp, ['id', 'skillId', 'title', 'frames', 'reviewStatus', 'provenance'], label);
  if (!isNonEmpty(exp.id)) errors.push(`${label}: missing "id"`);
  if (exp.skillId !== undefined && !isNonEmpty(exp.skillId)) errors.push(`${label}: "skillId" must be a non-empty string`);
  errors.push(...validateLocalizedText(exp.title, `${label}.title`));
  if (!REVIEW_STATUSES.includes(exp.reviewStatus as never)) {
    errors.push(`${label}: invalid "reviewStatus" ${JSON.stringify(exp.reviewStatus)}`);
  }
  const frames = exp.frames;
  if (!Array.isArray(frames) || frames.length < MIN_FRAMES || frames.length > MAX_FRAMES) {
    errors.push(`${label}: "frames" must be an array of ${MIN_FRAMES}-${MAX_FRAMES} frames`);
  } else {
    frames.forEach((f, i) => {
      const w = `${label}.frames[${i}]`;
      if (!isObj(f)) return errors.push(`${w}: must be an object`);
      errors.push(...unknownFields(f, ['text', 'visual', 'audio'], w));
      errors.push(...validateLocalizedText(f.text, `${w}.text`));
      if (f.visual !== undefined) errors.push(...validateVisual(f.visual, `${w}.visual`));
      if (f.audio !== undefined) errors.push(...validateMediaRef(f.audio, `${w}.audio`, 'audio'));
    });
  }
  errors.push(...validateProvenance(exp.provenance, `${label}.provenance`));
  return errors;
}

/* ------------------------------------------------------------------ */
/*  Skills                                                            */
/* ------------------------------------------------------------------ */

export function validateSkill(skill: unknown, where = 'skill'): string[] {
  if (!isObj(skill)) return [`${where}: must be an object`];
  const label = `${where}${isNonEmpty(skill.id) ? ` (${skill.id})` : ''}`;
  const errors = unknownFields(
    skill,
    ['id', 'subject', 'grade', 'semester', 'competences', 'title', 'prerequisites', 'itemSources', 'explanations', 'masteryCheck', 'provenance'],
    label,
  );

  if (!isNonEmpty(skill.id) || !/^[a-z0-9]+(\.[a-z0-9]+)+$/.test(skill.id)) {
    errors.push(`${label}: "id" must be dot-separated lowercase segments, e.g. "mat.add.carry.20"`);
  }
  if (!SUBJECT_IDS.includes(skill.subject as never)) {
    errors.push(`${label}: invalid "subject" ${JSON.stringify(skill.subject)}`);
  } else if (isNonEmpty(skill.id) && !skill.id.startsWith(`${skill.subject as string}.`)) {
    errors.push(`${label}: id must start with "${skill.subject as string}."`);
  }
  if (!isInt(skill.grade) || skill.grade < 0 || skill.grade > 8) errors.push(`${label}: "grade" must be an integer 0-8`);
  if (skill.semester !== 1 && skill.semester !== 2) errors.push(`${label}: "semester" must be 1 or 2`);

  if (!Array.isArray(skill.competences) || skill.competences.length === 0) {
    errors.push(`${label}: "competences" must be a non-empty array`);
  } else {
    skill.competences.forEach((c, i) => {
      const w = `${label}.competences[${i}]`;
      if (!isObj(c)) return errors.push(`${w}: must be { programa, code }`);
      errors.push(...unknownFields(c, ['programa', 'code'], w));
      if (!isNonEmpty(c.programa)) errors.push(`${w}: missing "programa"`);
      if (!isNonEmpty(c.code)) errors.push(`${w}: missing "code"`);
    });
  }
  errors.push(...validateLocalizedText(skill.title, `${label}.title`));

  const prereq = skill.prerequisites;
  if (!Array.isArray(prereq) || !prereq.every(isNonEmpty)) {
    errors.push(`${label}: "prerequisites" must be an array of skill ids`);
  } else {
    for (const d of duplicates(prereq as string[])) errors.push(`${label}: duplicate prerequisite "${d}"`);
    if (isNonEmpty(skill.id) && prereq.includes(skill.id)) errors.push(`${label}: skill lists itself as a prerequisite`);
  }

  if (!Array.isArray(skill.itemSources) || skill.itemSources.length === 0) {
    errors.push(`${label}: "itemSources" must be a non-empty array`);
  } else {
    skill.itemSources.forEach((s, i) => {
      const w = `${label}.itemSources[${i}]`;
      if (!isObj(s)) return errors.push(`${w}: must be an object`);
      const hasGen = s.generator !== undefined;
      const hasBank = s.bank !== undefined;
      if (hasGen === hasBank) return errors.push(`${w}: needs exactly one of "generator" or "bank"`);
      if (hasGen) {
        errors.push(...unknownFields(s, ['generator', 'params'], w));
        if (!isNonEmpty(s.generator)) errors.push(`${w}: "generator" must be a non-empty string`);
        if (s.params !== undefined && !isObj(s.params)) errors.push(`${w}: "params" must be an object`);
      } else {
        errors.push(...unknownFields(s, ['bank'], w));
        if (!isNonEmpty(s.bank)) errors.push(`${w}: "bank" must be a non-empty string`);
      }
    });
  }

  if (!Array.isArray(skill.explanations) || !skill.explanations.every(isNonEmpty)) {
    errors.push(`${label}: "explanations" must be an array of explanation ids`);
  } else {
    for (const d of duplicates(skill.explanations as string[])) errors.push(`${label}: duplicate explanation "${d}"`);
  }

  const mc = skill.masteryCheck;
  if (!isObj(mc)) errors.push(`${label}: missing "masteryCheck"`);
  else {
    errors.push(...unknownFields(mc, ['items', 'minCorrect'], `${label}.masteryCheck`));
    if (!isInt(mc.items) || mc.items < 1) errors.push(`${label}: masteryCheck.items must be an integer >= 1`);
    if (!isInt(mc.minCorrect) || mc.minCorrect < 1) errors.push(`${label}: masteryCheck.minCorrect must be an integer >= 1`);
    else if (isInt(mc.items) && mc.minCorrect > mc.items) {
      errors.push(`${label}: masteryCheck.minCorrect cannot exceed masteryCheck.items`);
    }
  }
  errors.push(...validateProvenance(skill.provenance, `${label}.provenance`));
  return errors;
}

/** Validate a list of skills (each one + unique ids). Does not check the graph. */
export function validateSkills(skills: unknown, where = 'skills'): string[] {
  if (!Array.isArray(skills)) return [`${where}: must be an array`];
  const errors = skills.flatMap((s, i) => validateSkill(s, `${where}[${i}]`));
  const ids = skills.filter(isObj).map((s) => s.id).filter(isNonEmpty);
  for (const d of duplicates(ids)) errors.push(`${where}: duplicate skill id "${d}"`);
  return errors;
}

/**
 * Graph-level checks: every prerequisite exists, no cycles (the path is reported),
 * and a prerequisite is never from a later grade/semester than the skill itself.
 */
export function validateSkillGraph(skills: readonly Skill[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, Skill>();
  for (const s of skills) byId.set(s.id, s);
  const term = (s: Skill) => s.grade * 2 + s.semester;

  for (const s of skills) {
    for (const p of s.prerequisites) {
      const pre = byId.get(p);
      if (!pre) errors.push(`skill ${s.id}: prerequisite "${p}" does not exist`);
      else if (term(pre) > term(s)) {
        errors.push(
          `skill ${s.id} (grade ${s.grade}, sem ${s.semester}): prerequisite "${p}" is from a later term (grade ${pre.grade}, sem ${pre.semester})`,
        );
      }
    }
  }

  /* Cycle detection (DFS, colours: 0 new, 1 on stack, 2 done) */
  const colour = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string) => {
    colour.set(id, 1);
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(p)) continue;
      const c = colour.get(p);
      if (c === 1) {
        const cycle = [...stack.slice(stack.indexOf(p)), p];
        errors.push(`prerequisite cycle: ${cycle.join(' -> ')}`);
      } else if (c === undefined) visit(p);
    }
    stack.pop();
    colour.set(id, 2);
  };
  for (const s of skills) if (!colour.has(s.id)) visit(s.id);
  return errors;
}
