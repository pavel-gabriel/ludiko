import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllSkills, getSkill } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems } from '../src/engine/items/generators';
import type { Item } from '../src/engine/types';
import { PLAY_PRESETS, effectiveGameType, skillSettings } from '../src/components/play/presets';
import {
  FAST_TYPES,
  MAX_SKILLS,
  allowedTypes,
  buildGameItems,
  buildItemMemoryCards,
  gameKind,
  isItemGame,
  memoryPairsFromItems,
  normalizeItems,
  sanitizeForRtdb,
  shortPrompt,
  skillUsable,
} from '../src/services/itemGame';
import { buildRoom } from '../src/services/roomManager';
import type { GameSettings } from '../src/utils/types';

/* roomManager imports firebase/database; none of its RTDB functions run here (buildRoom is pure) */
vi.mock('../src/services/firebase', () => ({ rtdb: {}, db: {}, firebaseEnabled: false }));

const ADD20 = 'mat.add.nocarry.20';
const SYLL = 'rom.syll.split.1';
const TEXT_SKILL = 'rom.text.literal.1';

describe('presets', () => {
  it('every preset points to skills that exist', () => {
    for (const p of PLAY_PRESETS) {
      expect(p.skillIds.length).toBeGreaterThan(0);
      expect(p.skillIds.length).toBeLessThanOrEqual(MAX_SKILLS);
      for (const id of p.skillIds) expect(getSkill(id), `${p.id}: ${id}`).toBeDefined();
    }
  });

  it('every preset is playable as a race (and has an i18n label)', () => {
    for (const p of PLAY_PRESETS) {
      expect(p.skillIds.some((id) => skillUsable(id, 'race')), p.id).toBe(true);
      expect(p.labelKey).toMatch(/^play\.preset\./);
    }
  });
});

describe('item generation for races', () => {
  it('builds the requested number of items, mixed across skills, of raceable types', () => {
    const items = buildGameItems([ADD20, SYLL], { count: 10, kind: 'race', seed: 5 });
    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.skillId))).toEqual(new Set([ADD20, SYLL]));
    expect(new Set(items.map((i) => i.id)).size).toBe(10);
    for (const i of items) expect(allowedTypes('race')).toContain(i.type);
  });

  it('is deterministic for a fixed seed', () => {
    const a = buildGameItems([ADD20], { count: 8, kind: 'race', seed: 11 }).map((i) => i.id);
    const b = buildGameItems([ADD20], { count: 8, kind: 'race', seed: 11 }).map((i) => i.id);
    expect(a).toEqual(b);
  });

  it('sprint only uses quick types', () => {
    const items = buildGameItems(['mat.placevalue.100', 'rom.letters.case.0'], { count: 20, kind: 'sprint', seed: 3 });
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(FAST_TYPES).toContain(i.type);
  });

  it('text-comprehension skills (read-and-answer) produce nothing for games and are not offered', () => {
    expect(buildGameItems([TEXT_SKILL], { count: 5, kind: 'race', seed: 1 })).toEqual([]);
    expect(skillUsable(TEXT_SKILL, 'race')).toBe(false);
    expect(skillUsable(TEXT_SKILL, 'memory')).toBe(false);
    expect(skillUsable(ADD20, 'race')).toBe(true);
    expect(skillUsable(ADD20, 'sprint')).toBe(true);
    expect(skillUsable(ADD20, 'memory')).toBe(true);
  });

  it('works for a Romanian reading skill and a math III skill', () => {
    for (const id of [SYLL, 'mat.mul.table.small', 'mat.equation.unknown']) {
      const items = buildGameItems([id], { count: 6, kind: 'race', difficulty: 'medium', seed: 9 });
      expect(items.length, id).toBe(6);
      for (const i of items) expect(i.skillId).toBe(id);
    }
  });

  it('every skill that can be raced yields a full round (no skill leaves a race short)', () => {
    for (const s of getAllSkills()) {
      if (!skillUsable(s.id, 'race')) continue;
      expect(buildGameItems([s.id], { count: 10, kind: 'race', seed: 2 }).length, s.id).toBe(10);
    }
  });

  it('ignores unknown skill ids and caps the selection', () => {
    expect(buildGameItems(['no.such.skill'], { count: 5, kind: 'race' })).toEqual([]);
    const ids = getAllSkills().filter((s) => skillUsable(s.id, 'race')).slice(0, 8).map((s) => s.id);
    const items = buildGameItems(ids, { count: 20, kind: 'race', seed: 4 });
    expect(new Set(items.map((i) => i.skillId)).size).toBeLessThanOrEqual(MAX_SKILLS);
  });
});

describe('RTDB-safe item JSON', () => {
  const has = (v: unknown, pred: (x: unknown) => boolean): boolean => {
    if (pred(v)) return true;
    if (Array.isArray(v)) return v.some((x) => has(x, pred));
    if (v && typeof v === 'object') return Object.values(v).some((x) => has(x, pred));
    return false;
  };

  it('removes undefined, null, NaN and empty containers; keeps everything a renderer needs', () => {
    const dirty = {
      a: undefined,
      b: null,
      c: Number.NaN,
      d: Infinity,
      e: [],
      f: {},
      g: [1, undefined, 2],
      h: { x: undefined, y: 'ok', 'bad.key': 1 },
      s: '',
      z: 0,
      t: false,
    };
    expect(sanitizeForRtdb(dirty)).toEqual({ g: [1, 2], h: { y: 'ok', bad_key: 1 }, s: '', z: 0, t: false });
  });

  it('generated items survive sanitizing: same answers, nothing RTDB would reject', () => {
    const skills = ['mat.add.nocarry.20', 'rom.word.picture.0', 'mat.clock.half', 'mat.geom.shapes', 'mat.money.change'];
    for (const id of skills) {
      const items = generateItems(getSkill(id)!, 12, { seed: 21 });
      const safe = sanitizeForRtdb(items);
      expect(has(safe, (x) => x === undefined || x === null || (typeof x === 'number' && !Number.isFinite(x)))).toBe(false);
      // what RTDB stores is the JSON of this value
      expect(JSON.parse(JSON.stringify(safe))).toEqual(safe);
      // idempotent: reading back and re-writing changes nothing
      expect(sanitizeForRtdb(safe)).toEqual(safe);
      // still answerable: pick the right answer from the sanitized copy
      safe.forEach((item, i) => {
        expect(item.id).toBe(items[i].id);
        if (item.type === 'choice' || item.type === 'picture-choice') {
          expect(checkResponse(item, { type: item.type, selectedId: item.correctId })).toBe(true);
        }
        if (item.type === 'number-input') expect(checkResponse(item, { type: 'number-input', value: item.correct })).toBe(true);
      });
    }
  });

  it('optional fields set to undefined do not reach the database', () => {
    const item = { ...generateItems(getSkill(ADD20)!, 1, { seed: 1 })[0], visual: undefined, audio: undefined } as Item;
    const safe = sanitizeForRtdb([item])[0] as unknown as Record<string, unknown>;
    expect('visual' in safe).toBe(false);
    expect('audio' in safe).toBe(false);
  });

  it('normalizeItems drops holes and accepts an object-shaped array', () => {
    const items = generateItems(getSkill(ADD20)!, 3, { seed: 2 });
    expect(normalizeItems([items[0], null, items[1]])).toHaveLength(2);
    expect(normalizeItems({ 0: items[0], 1: items[1] })).toHaveLength(2);
    expect(normalizeItems(undefined)).toEqual([]);
  });
});

describe('memory pairs from items', () => {
  it('builds a board where every pair has two distinct short faces', () => {
    const cards = buildItemMemoryCards([ADD20], 6, { seed: 7 })!;
    expect(cards).toHaveLength(12);
    const byPair = new Map<string, string[]>();
    for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.emoji]);
    expect(byPair.size).toBe(6);
    for (const faces of byPair.values()) {
      expect(faces).toHaveLength(2);
      expect(faces[0]).not.toBe(faces[1]);
      faces.forEach((f) => expect(f.length).toBeLessThanOrEqual(18));
    }
    expect(new Set(cards.map((c) => c.id)).size).toBe(12);
    expect(cards.every((c) => !c.flipped && !c.matched)).toBe(true);
  });

  it('operation <-> result pairs are arithmetically right', () => {
    const calc = (e: string) => Function(`return (${e.replace(/×/g, '*').replace(/−/g, '-')})`)() as number;
    for (const skill of ['mat.add.carry.20', 'mat.mul.table.small']) {
      const cards = buildItemMemoryCards([skill], 8, { seed: 3 })!;
      const byPair = new Map<string, string[]>();
      for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.emoji]);
      expect(byPair.size).toBe(8);
      for (const [a, b] of byPair.values()) {
        const [expr, other] = /[+×−-]/.test(a) ? [a, b] : [b, a];
        if (expr.includes('=')) {
          // "6 + ? = 12" <-> "6": the answer fills the gap
          const [l, r] = expr.replace('?', other).split('=');
          expect(calc(l), `${a} / ${b}`).toBe(calc(r));
        } else {
          expect(calc(expr), `${a} / ${b}`).toBe(Number(other));
        }
      }
    }
  });

  it('letter pairs may differ only by case (A <-> a)', () => {
    const cards = buildItemMemoryCards(['rom.letters.case.0'], 5, { seed: 4 })!;
    expect(cards).toHaveLength(10);
    const byPair = new Map<string, string[]>();
    for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.emoji]);
    for (const [a, b] of byPair.values()) expect(a.toLowerCase()).toBe(b.toLowerCase());
  });

  it('word <-> syllables pairs rebuild the word', () => {
    const cards = buildItemMemoryCards([SYLL], 5, { seed: 8 })!;
    const byPair = new Map<string, string[]>();
    for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.emoji]);
    for (const [a, b] of byPair.values()) {
      const [word, split] = a.includes('-') ? [b, a] : [a, b];
      expect(split.replace(/-/g, '')).toBe(word);
    }
  });

  it('word <-> picture: match items give a text face and an emoji face (only the text face is marked as text)', () => {
    const cards = buildItemMemoryCards(['rom.word.picture.0'], 5, { seed: 2 })!;
    expect(cards.length).toBe(10);
    expect(cards.filter((c) => c.isText)).toHaveLength(5);
    expect(cards.filter((c) => !c.isText)).toHaveLength(5);
  });

  it('mixes the chosen skills', () => {
    const cards = buildItemMemoryCards([ADD20, SYLL], 6, { seed: 1 })!;
    const faces = cards.map((c) => c.emoji);
    expect(faces.some((f) => f.includes('+') || /^\d+$/.test(f))).toBe(true);
    expect(faces.some((f) => /[a-zăâîșț]{3,}/i.test(f))).toBe(true);
  });

  it('returns null when a skill cannot make pairs (the host then falls back to the emoji board)', () => {
    expect(buildItemMemoryCards([TEXT_SKILL], 6)).toBeNull();
    expect(buildItemMemoryCards(['no.such.skill'], 6)).toBeNull();
  });

  it('shortPrompt extracts the card text', () => {
    expect(shortPrompt('Cât face 7 + 2?')).toBe('7 + 2');
    expect(shortPrompt('Află numărul necunoscut: ? − 487 = 36')).toBe('? − 487 = 36');
    expect(shortPrompt('Care imagine se potrivește cu cuvântul „pară”?')).toBe('pară');
    expect(shortPrompt('Cum se desparte în silabe cuvântul „veveriță”?')).toBe('veveriță');
    expect(shortPrompt('O propoziție mult prea lungă ca să încapă pe un card de memorie')).toBeNull();
  });

  it('memoryPairsFromItems skips ambiguous duplicates', () => {
    const one = generateItems(getSkill(ADD20)!, 1, { seed: 1 })[0];
    const pairs = memoryPairsFromItems([one, { ...one, id: 'copy' }]);
    expect(pairs.length).toBeLessThanOrEqual(1);
  });
});

describe('settings: backward compatibility', () => {
  const v1: GameSettings = {
    gameType: 'mathRace',
    gameMode: 'raceToFinish',
    difficulty: 'easy',
    operations: ['+', '-'],
    rounds: 10,
    timePerRound: 15,
  };

  it('settings without skillIds are v1 rooms', () => {
    expect(isItemGame(v1)).toBe(false);
    expect(isItemGame({ ...v1, skillIds: [] })).toBe(false);
    expect(isItemGame({ ...v1, skillIds: [ADD20] })).toBe(true);
    expect(isItemGame(null)).toBe(false);
  });

  it('skillSettings adds nothing for no skills and never undefined values (RTDB)', () => {
    expect(skillSettings([])).toEqual({});
    const s = skillSettings([ADD20, SYLL]);
    expect(s).toEqual({ skillIds: [ADD20, SYLL], subject: 'mixed' });
    expect(skillSettings([ADD20]).subject).toBe('mat');
    const room = buildRoom('Ana', { ...v1, ...skillSettings([]) });
    expect('skillIds' in room.settings).toBe(false);
    expect(JSON.stringify(room)).not.toContain('undefined');
    expect(buildRoom('Ana', { ...v1, ...skillSettings([ADD20]) }).settings.skillIds).toEqual([ADD20]);
  });

  it('with skills the game type only picks race vs memory', () => {
    expect(effectiveGameType([], 'shapeMatch')).toBe('shapeMatch');
    expect(effectiveGameType([ADD20], 'shapeMatch')).toBe('mathRace');
    expect(effectiveGameType([ADD20], 'equations')).toBe('mathRace');
    expect(effectiveGameType([ADD20], 'memoryGame')).toBe('memoryGame');
  });

  it('gameKind', () => {
    expect(gameKind({ gameType: 'mathRace', gameMode: 'raceToFinish' })).toBe('race');
    expect(gameKind({ gameType: 'mathRace', gameMode: 'timedSprint' })).toBe('sprint');
    expect(gameKind({ gameType: 'memoryGame', gameMode: 'timedSprint' })).toBe('memory');
  });
});

/* ---------------- host: which RTDB writer runs for which settings ---------------- */

const writers = vi.hoisted(() => ({
  initItemGameState: vi.fn(),
  initMathGameState: vi.fn(),
  initShapeGameState: vi.fn(),
  initMemoryGameState: vi.fn(),
}));
vi.mock('../src/services/gameSession', () => writers);

describe('initRoomGame (host)', () => {
  const base: GameSettings = {
    gameType: 'mathRace',
    gameMode: 'raceToFinish',
    difficulty: 'easy',
    operations: ['+', '-'],
    rounds: 8,
    timePerRound: 15,
  };
  beforeEach(() => Object.values(writers).forEach((f) => f.mockReset()));

  it('skills chosen: writes sanitized items (no questions), one per round', async () => {
    const { initRoomGame } = await import('../src/services/roomGame');
    await initRoomGame('room1', { ...base, skillIds: [ADD20, SYLL] }, ['p1', 'p2']);
    expect(writers.initItemGameState).toHaveBeenCalledTimes(1);
    expect(writers.initMathGameState).not.toHaveBeenCalled();
    const [roomId, items, players, gameType] = writers.initItemGameState.mock.calls[0];
    expect(roomId).toBe('room1');
    expect(players).toEqual(['p1', 'p2']);
    expect(gameType).toBe('mathRace');
    expect(items).toHaveLength(8);
    expect(JSON.parse(JSON.stringify(items))).toEqual(items);
  });

  it('sprint: a large item pool', async () => {
    const { initRoomGame } = await import('../src/services/roomGame');
    await initRoomGame('r', { ...base, gameMode: 'timedSprint', skillIds: [ADD20] }, ['p1']);
    expect(writers.initItemGameState.mock.calls[0][1].length).toBeGreaterThanOrEqual(60);
  });

  it('memory with skills: item-based board', async () => {
    const { initRoomGame } = await import('../src/services/roomGame');
    await initRoomGame('r', { ...base, gameType: 'memoryGame', rounds: 5, skillIds: [ADD20] }, ['p1']);
    const cards = writers.initMemoryGameState.mock.calls[0][1];
    expect(cards).toHaveLength(10);
    expect(cards.every((c: { isText?: boolean }) => c.isText)).toBe(true);
  });

  it('old settings (no skillIds): the v1 generators, exactly as before', async () => {
    const { initRoomGame } = await import('../src/services/roomGame');
    await initRoomGame('r', base, ['p1']);
    expect(writers.initItemGameState).not.toHaveBeenCalled();
    expect(writers.initMathGameState).toHaveBeenCalledTimes(1);
    const [, questions, , gameType] = writers.initMathGameState.mock.calls[0];
    expect(questions).toHaveLength(8);
    expect(questions[0]).toHaveProperty('correctAnswer');
    expect(gameType).toBe('mathRace');

    writers.initMathGameState.mockReset();
    await initRoomGame('r', { ...base, gameType: 'countingGame', gameMode: 'timedSprint' }, ['p1']);
    expect(writers.initMathGameState.mock.calls[0][1]).toHaveLength(100);

    await initRoomGame('r', { ...base, gameType: 'shapeMatch' }, ['p1']);
    expect(writers.initShapeGameState.mock.calls[0][1]).toHaveLength(8);

    await initRoomGame('r', { ...base, gameType: 'memoryGame', rounds: 6 }, ['p1']);
    const emojiCards = writers.initMemoryGameState.mock.calls[0][1];
    expect(emojiCards).toHaveLength(12);
    expect(emojiCards.some((c: { isText?: boolean }) => c.isText)).toBe(false);
  });

  it('a skill selection nothing can be played from falls back to the v1 game instead of hanging', async () => {
    const { initRoomGame } = await import('../src/services/roomGame');
    await initRoomGame('r', { ...base, skillIds: [TEXT_SKILL] }, ['p1']);
    expect(writers.initItemGameState).not.toHaveBeenCalled();
    expect(writers.initMathGameState).toHaveBeenCalledTimes(1);
  });
});
