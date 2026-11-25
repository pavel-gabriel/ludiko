import { describe, it, expect } from 'vitest';
import { answersMatch, checkResponse, normalizeText, parseNumeric } from '../src/engine/items/check';
import type { Item, ItemBase } from '../src/engine/types';

const base: Omit<ItemBase, 'id' | 'type'> = {
  skillId: 'test.skill',
  difficulty: 1,
  prompt: { ro: 'Test' },
  reviewStatus: 'beta',
  provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
};

const choice: Item = {
  ...base, id: 'c', type: 'choice',
  options: [{ id: 'a', text: { ro: 'A' } }, { id: 'b', text: { ro: 'B' } }],
  correctId: 'b',
};
const pictureChoice: Item = {
  ...base, id: 'pc', type: 'picture-choice',
  options: [
    { id: 'a', visual: { kind: 'objects', icon: '⭐', count: 2 } },
    { id: 'b', visual: { kind: 'objects', icon: '⭐', count: 3 } },
  ],
  correctId: 'a',
};
const trueFalse: Item = { ...base, id: 'tf', type: 'true-false', correct: false };
const numberInput: Item = { ...base, id: 'n', type: 'number-input', correct: 8 };
const fillNum: Item = { ...base, id: 'fn', type: 'fill-gap', template: { ro: '{{gap}} + 7 = 15' }, correct: '8' };
const fillText: Item = { ...base, id: 'ft', type: 'fill-gap', template: { ro: 'Vara este {{gap}}.' }, correct: 'Cald' };
const order: Item = {
  ...base, id: 'o', type: 'order',
  cards: [{ id: 'x' }, { id: 'y' }, { id: 'z' }],
  correctOrder: ['x', 'y', 'z'],
};
const sort: Item = {
  ...base, id: 's', type: 'sort',
  categories: [{ id: 'even', label: { ro: 'Pare' } }, { id: 'odd', label: { ro: 'Impare' } }],
  cards: [
    { id: 'c2', categoryId: 'even' },
    { id: 'c3', categoryId: 'odd' },
  ],
};
const match: Item = {
  ...base, id: 'm', type: 'match',
  pairs: [
    { left: { id: 'l1' }, right: { id: 'r1' } },
    { left: { id: 'l2' }, right: { id: 'r2' } },
  ],
};
const hotspot: Item = {
  ...base, id: 'h', type: 'hotspot',
  image: { kind: 'image', src: 'x.svg', alt: { ro: 'x' } },
  regions: [{ id: 'r1', x: 1, y: 1, r: 1 }, { id: 'r2', x: 2, y: 2, r: 1 }],
  correctId: 'r2',
};
const listen: Item = {
  ...base, id: 'l', type: 'listen-and-answer',
  audio: { kind: 'audio', src: 'a.mp3', alt: { ro: 'a' } },
  options: [{ id: 'a' }, { id: 'b' }],
  correctId: 'a',
};
const q1 = { ...base, id: 'q1', type: 'choice' as const, options: [{ id: 'a' }, { id: 'b' }], correctId: 'a' };
const q2 = { ...base, id: 'q2', type: 'true-false' as const, correct: true };
const readAnswer: Item = { ...base, id: 'r', type: 'read-and-answer', passage: { ro: 'Text' }, questions: [q1, q2] };

describe('checkResponse', () => {
  it('choice / picture-choice / listen-and-answer / hotspot', () => {
    expect(checkResponse(choice, { type: 'choice', selectedId: 'b' })).toBe(true);
    expect(checkResponse(choice, { type: 'choice', selectedId: 'a' })).toBe(false);
    expect(checkResponse(pictureChoice, { type: 'picture-choice', selectedId: 'a' })).toBe(true);
    expect(checkResponse(pictureChoice, { type: 'picture-choice', selectedId: 'b' })).toBe(false);
    expect(checkResponse(listen, { type: 'listen-and-answer', selectedId: 'a' })).toBe(true);
    expect(checkResponse(listen, { type: 'listen-and-answer', selectedId: 'b' })).toBe(false);
    expect(checkResponse(hotspot, { type: 'hotspot', selectedId: 'r2' })).toBe(true);
    expect(checkResponse(hotspot, { type: 'hotspot', selectedId: 'r1' })).toBe(false);
  });

  it('true-false', () => {
    expect(checkResponse(trueFalse, { type: 'true-false', value: false })).toBe(true);
    expect(checkResponse(trueFalse, { type: 'true-false', value: true })).toBe(false);
  });

  it('number-input', () => {
    expect(checkResponse(numberInput, { type: 'number-input', value: 8 })).toBe(true);
    expect(checkResponse(numberInput, { type: 'number-input', value: 9 })).toBe(false);
    expect(checkResponse(numberInput, { type: 'number-input', value: NaN })).toBe(false);
  });

  it('fill-gap: numeric answers accept leading zeros, whitespace and comma decimals', () => {
    expect(checkResponse(fillNum, { type: 'fill-gap', value: '8' })).toBe(true);
    expect(checkResponse(fillNum, { type: 'fill-gap', value: '08' })).toBe(true);
    expect(checkResponse(fillNum, { type: 'fill-gap', value: ' 8 ' })).toBe(true);
    expect(checkResponse(fillNum, { type: 'fill-gap', value: '9' })).toBe(false);
    expect(checkResponse(fillNum, { type: 'fill-gap', value: '' })).toBe(false);
  });

  it('fill-gap: text answers are trimmed and case-insensitive', () => {
    expect(checkResponse(fillText, { type: 'fill-gap', value: 'cald' })).toBe(true);
    expect(checkResponse(fillText, { type: 'fill-gap', value: '  CALD  ' })).toBe(true);
    expect(checkResponse(fillText, { type: 'fill-gap', value: 'rece' })).toBe(false);
  });

  it('order', () => {
    expect(checkResponse(order, { type: 'order', order: ['x', 'y', 'z'] })).toBe(true);
    expect(checkResponse(order, { type: 'order', order: ['y', 'x', 'z'] })).toBe(false);
    expect(checkResponse(order, { type: 'order', order: ['x', 'y'] })).toBe(false);
  });

  it('sort', () => {
    expect(checkResponse(sort, { type: 'sort', placement: { c2: 'even', c3: 'odd' } })).toBe(true);
    expect(checkResponse(sort, { type: 'sort', placement: { c2: 'odd', c3: 'odd' } })).toBe(false);
    expect(checkResponse(sort, { type: 'sort', placement: { c2: 'even' } })).toBe(false);
    expect(checkResponse(sort, { type: 'sort', placement: { c2: 'even', c3: 'odd', zz: 'odd' } })).toBe(false);
  });

  it('match', () => {
    expect(checkResponse(match, { type: 'match', pairs: { l1: 'r1', l2: 'r2' } })).toBe(true);
    expect(checkResponse(match, { type: 'match', pairs: { l1: 'r2', l2: 'r1' } })).toBe(false);
    expect(checkResponse(match, { type: 'match', pairs: { l1: 'r1' } })).toBe(false);
  });

  it('read-and-answer: every sub-question must be right', () => {
    const good = { type: 'read-and-answer' as const, answers: {
      q1: { type: 'choice' as const, selectedId: 'a' },
      q2: { type: 'true-false' as const, value: true },
    } };
    expect(checkResponse(readAnswer, good)).toBe(true);
    expect(checkResponse(readAnswer, { ...good, answers: { ...good.answers, q2: { type: 'true-false', value: false } } })).toBe(false);
    expect(checkResponse(readAnswer, { type: 'read-and-answer', answers: { q1: good.answers.q1 } })).toBe(false);
  });

  it('a response of the wrong type is incorrect, never an exception', () => {
    expect(checkResponse(choice, { type: 'true-false', value: true })).toBe(false);
    expect(checkResponse(hotspot, { type: 'choice', selectedId: 'r2' })).toBe(false);
  });
});

describe('helpers', () => {
  it('parseNumeric', () => {
    expect(parseNumeric('08')).toBe(8);
    expect(parseNumeric(' 2,5 ')).toBe(2.5);
    expect(parseNumeric('-3')).toBe(-3);
    expect(parseNumeric('abc')).toBeNull();
    expect(parseNumeric('')).toBeNull();
  });
  it('normalizeText unifies Romanian diacritic variants', () => {
    expect(normalizeText('  Şcoală ')).toBe(normalizeText('școală'));
    expect(normalizeText('Ţara')).toBe('țara');
  });
  it('answersMatch', () => {
    expect(answersMatch('08', '8')).toBe(true);
    expect(answersMatch('Da', 'da')).toBe(true);
    expect(answersMatch('1', 'a')).toBe(false);
  });
});
