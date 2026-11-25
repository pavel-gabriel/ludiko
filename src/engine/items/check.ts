/**
 * Pure answer checking for every item type (docs/PLAN.md §5.3).
 * No React, no side effects — usable by renderers, generators, mastery engine and tests.
 */
import type { Item, ItemResponse } from '../types';

/** Normalise a typed answer: trim, lower-case, unify Romanian cedilla/comma diacritics, collapse spaces */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/ş/g, 'ș')
    .replace(/ţ/g, 'ț')
    .replace(/\s+/g, ' ');
}

/** Parse a plain decimal number ("8", "08", "-3", "2,5", "2.5"); returns null when it is not numeric */
export function parseNumeric(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!/^[-+]?(\d+(\.\d+)?|\.\d+)$/.test(t)) return null;
  return Number(t);
}

/** Compare a typed/chosen answer to the expected one: numerically when both are numbers ("08" == "8"), else as text */
export function answersMatch(given: string, expected: string): boolean {
  const g = parseNumeric(given);
  const e = parseNumeric(expected);
  if (g !== null && e !== null) return g === e;
  return normalizeText(given) === normalizeText(expected);
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
}

/**
 * Is `response` a correct answer to `item`?
 * A response of the wrong type for the item is simply incorrect (never throws).
 */
export function checkResponse(item: Item, response: ItemResponse): boolean {
  if (!response || response.type !== item.type) return false;

  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer':
    case 'hotspot':
      return 'selectedId' in response && response.selectedId === item.correctId;

    case 'true-false':
      return response.type === 'true-false' && response.value === item.correct;

    case 'number-input':
      return (
        response.type === 'number-input' &&
        Number.isFinite(response.value) &&
        response.value === item.correct
      );

    case 'fill-gap':
      return response.type === 'fill-gap' && answersMatch(response.value, item.correct);

    case 'order':
      return (
        response.type === 'order' &&
        response.order.length === item.correctOrder.length &&
        response.order.every((id, i) => id === item.correctOrder[i])
      );

    case 'sort': {
      if (response.type !== 'sort') return false;
      const placed = Object.keys(response.placement);
      if (!sameSet(placed, item.cards.map((c) => c.id))) return false;
      return item.cards.every((c) => response.placement[c.id] === c.categoryId);
    }

    case 'match': {
      if (response.type !== 'match') return false;
      const left = Object.keys(response.pairs);
      if (!sameSet(left, item.pairs.map((p) => p.left.id))) return false;
      return item.pairs.every((p) => response.pairs[p.left.id] === p.right.id);
    }

    case 'read-and-answer': {
      if (response.type !== 'read-and-answer') return false;
      return item.questions.every((q) => {
        const r = response.answers[q.id];
        return r !== undefined && checkResponse(q, r);
      });
    }

    default:
      return false;
  }
}
