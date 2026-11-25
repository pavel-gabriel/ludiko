/**
 * Item-based multiplayer games (docs/PLAN.md §7, §12): pure helpers, no Firebase, no React.
 *
 * A room whose `settings.skillIds` is non-empty runs on shared `Item`s instead of the v1 `Question`s:
 *  - Race / Sprint: the host generates `Item[]` here, stores them (sanitized) in the RTDB game state
 *    (`game.items`) and every player renders them with `ItemView`.
 *  - Memory: cards are built from items that have a short prompt and a short answer
 *    (operation <-> result, word <-> syllables, word <-> picture).
 *
 * Backward compatibility: rooms without `skillIds` (everything created before v2) keep the v1 generators
 * in `gameEngine.ts`; their game state has `questions` and no `items`, and the pages render by what the
 * game state contains, so an old room state keeps working untouched.
 */
import { getSkill } from '@/engine/content/registry';
import { generateItems, mulberry32 } from '@/engine/items/generators';
import {
  localize,
  type CardContent,
  type Difficulty as ItemDifficulty,
  type Item,
  type ItemType,
  type Skill,
} from '@/engine/types';
import { getSessionItems } from '@/ui/session/itemSource';
import type { Difficulty, GameSettings, MemoryCard } from '@/utils/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** At most this many skills can be mixed in one game */
export const MAX_SKILLS = 5;
/** Item pool for a timed sprint (players answer as many as they can) */
export const ITEM_SPRINT_POOL = 80;
/** Fewest pairs that still make a memory game */
export const MIN_MEMORY_PAIRS = 3;

export type ItemGameKind = 'race' | 'sprint' | 'memory';

/** Quick single-tap or typed answers: fine in every timed mode */
export const FAST_TYPES: readonly ItemType[] = ['choice', 'picture-choice', 'true-false', 'number-input', 'fill-gap'];
/** Multi-step types are allowed in a race (a round has time), never in a sprint */
const RACE_TYPES: readonly ItemType[] = [...FAST_TYPES, 'order', 'sort', 'match', 'hotspot'];

/**
 * Item types a mode can show. `read-and-answer` and `listen-and-answer` are never raced: they are
 * slow (reading a passage / audio), so skills made only of them (the text-comprehension skills)
 * are not offered for games.
 */
export function allowedTypes(kind: ItemGameKind): readonly ItemType[] {
  return kind === 'race' ? RACE_TYPES : FAST_TYPES;
}

/** The game mode a room's settings describe */
export function gameKind(settings: Pick<GameSettings, 'gameType' | 'gameMode'>): ItemGameKind {
  if (settings.gameType === 'memoryGame') return 'memory';
  return settings.gameMode === 'timedSprint' ? 'sprint' : 'race';
}

/** True when the room runs on the item model (skills were chosen) */
export function isItemGame(settings: Pick<GameSettings, 'skillIds'> | null | undefined): boolean {
  return Array.isArray(settings?.skillIds) && settings!.skillIds!.length > 0;
}

/** Setup UI difficulty (easy/medium/hard) -> item difficulty. Medium = the generators' mixed 1-3 default. */
export function itemDifficulty(d: Difficulty | undefined): ItemDifficulty | undefined {
  if (d === 'easy') return 1;
  if (d === 'hard') return 3;
  return undefined;
}

export { normalizeItems, sanitizeForRtdb } from './rtdbSafe';

/* ------------------------------------------------------------------ */
/*  Item generation for race / sprint                                 */
/* ------------------------------------------------------------------ */

export function resolveSkills(skillIds: readonly string[] | undefined): Skill[] {
  const out: Skill[] = [];
  for (const id of (skillIds ?? []).slice(0, MAX_SKILLS)) {
    const s = getSkill(id);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function skillItems(skill: Skill, count: number, difficulty: ItemDifficulty | undefined, seed: number): Item[] {
  if (skill.itemSources.some((s) => 'generator' in s)) return generateItems(skill, count, { difficulty, seed });
  return getSessionItems(skill, count, mulberry32(seed));
}

export interface BuildItemsOptions {
  /** Final number of items */
  count: number;
  kind: ItemGameKind;
  difficulty?: Difficulty;
  /** Fixed seed (tests); default random */
  seed?: number;
}

/**
 * `count` items for the chosen skills, interleaved round-robin (so a mix of skills stays mixed),
 * of types the mode can show. May return fewer than `count` (or none) when the skills yield too few
 * playable items; the caller decides what to do (`skillUsable` lets the UI avoid that).
 */
export function buildGameItems(skillIds: readonly string[], opts: BuildItemsOptions): Item[] {
  const skills = resolveSkills(skillIds);
  if (skills.length === 0 || opts.count <= 0) return [];
  const allowed = allowedTypes(opts.kind);
  const diff = itemDifficulty(opts.difficulty);
  const master = mulberry32(((opts.seed ?? Math.floor(Math.random() * 2 ** 31)) ^ 0x51ed270b) >>> 0);

  const perSkillNeed = Math.ceil(opts.count / skills.length) + 3;
  const pools: Item[][] = skills.map(() => []);
  const seen = new Set<string>();

  /* Up to 4 passes of fresh generation until the pools can fill the request */
  for (let pass = 0; pass < 4; pass++) {
    skills.forEach((skill, i) => {
      const fresh = skillItems(skill, perSkillNeed * 2, diff, Math.floor(master() * 2 ** 31));
      for (const item of fresh) {
        if (!allowed.includes(item.type) || seen.has(item.id)) continue;
        seen.add(item.id);
        pools[i].push(item);
      }
    });
    if (pools.reduce((n, p) => n + p.length, 0) >= opts.count) break;
  }

  const out: Item[] = [];
  let progressed = true;
  while (out.length < opts.count && progressed) {
    progressed = false;
    for (const pool of pools) {
      const next = pool.shift();
      if (next) {
        out.push(next);
        progressed = true;
        if (out.length >= opts.count) break;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Memory pairs from items                                           */
/* ------------------------------------------------------------------ */

const MAX_LEFT = 18;
const MAX_RIGHT = 14;

interface Face {
  text: string;
  /** true for a picture (emoji), false for text */
  picture: boolean;
}

/** The shortest recognisable face of a card: its text, or the emoji of an `objects` visual */
function cardFace(card: CardContent | undefined, lang: string): Face | null {
  if (!card) return null;
  const text = localize(card.text, lang).trim();
  if (text) return { text, picture: false };
  if (card.visual && card.visual.kind === 'objects') return { text: card.visual.icon, picture: true };
  return null;
}

const QUOTED = /[„“"]([^”“"]{1,16})[”"]/;
const EXPRESSION = /[\d?(][\d\s.,?()+\-−×÷:·*=]*[\d?)]/;
const OPERATOR = /[+\-−×÷:·*]/;

/** A short card text for an item prompt: a quoted word, a math expression, or a short sentence */
export function shortPrompt(text: string): string | null {
  const t = text.trim();
  const quoted = QUOTED.exec(t);
  if (quoted) return quoted[1].trim();
  const expr = EXPRESSION.exec(t);
  if (expr && OPERATOR.test(expr[0]) && expr[0].trim().length >= 3) {
    let e = expr[0].trim();
    if (e.endsWith('?') && !e.includes('=') && /\d\s*\?$/.test(e)) e = e.slice(0, -1).trim();
    return e;
  }
  return t.length <= 14 ? t : null;
}

export interface MemoryPair {
  left: Face;
  right: Face;
}

function pairsFromItem(item: Item, lang: string): MemoryPair[] {
  switch (item.type) {
    case 'match':
      return item.pairs.flatMap((p) => {
        const l = cardFace(p.left, lang);
        const r = cardFace(p.right, lang);
        return l && r ? [{ left: l, right: r }] : [];
      });
    case 'number-input': {
      const l = shortPrompt(localize(item.prompt, lang));
      return l ? [{ left: { text: l, picture: false }, right: { text: String(item.correct), picture: false } }] : [];
    }
    case 'fill-gap': {
      const tpl = localize(item.template, lang);
      let left = tpl.replace('{{gap}}', '?').trim();
      if (left.endsWith('= ?')) left = left.slice(0, -3).trim();
      return left ? [{ left: { text: left, picture: false }, right: { text: item.correct, picture: false } }] : [];
    }
    case 'choice':
    case 'picture-choice': {
      const l = shortPrompt(localize(item.prompt, lang));
      const r = cardFace(item.options.find((o) => o.id === item.correctId), lang);
      return l && r ? [{ left: { text: l, picture: false }, right: r }] : [];
    }
    default:
      return [];
  }
}

function usable(p: MemoryPair): boolean {
  const l = p.left.text.trim();
  const r = p.right.text.trim();
  return (
    l.length > 0 &&
    r.length > 0 &&
    l.length <= MAX_LEFT &&
    r.length <= MAX_RIGHT &&
    l !== r
  );
}

/** Distinct (by both faces) short pairs derivable from `items`, in order */
export function memoryPairsFromItems(items: readonly Item[], lang = 'ro'): MemoryPair[] {
  const lefts = new Set<string>();
  const rights = new Set<string>();
  const out: MemoryPair[] = [];
  for (const item of items) {
    for (const p of pairsFromItem(item, lang)) {
      if (!usable(p)) continue;
      const lk = p.left.text.toLowerCase();
      const rk = p.right.text.toLowerCase();
      if (lefts.has(lk) || rights.has(rk) || lefts.has(rk) || rights.has(lk)) continue;
      lefts.add(lk);
      rights.add(rk);
      out.push(p);
    }
  }
  return out;
}

function shuffled<T>(arr: readonly T[], rnd: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Memory board built from the skills' items: each pair of cards shows the two faces of one item
 * ("3 + 4" and "7"; "veveriță" and "ve-ve-ri-ță"; "pară" and 🍐). Returns `null` when fewer than
 * MIN_MEMORY_PAIRS pairs can be made (the caller falls back to the emoji board).
 * May return fewer pairs than asked for; pages use `cards.length / 2` as the real total.
 */
export function buildItemMemoryCards(
  skillIds: readonly string[],
  pairCount: number,
  opts: { difficulty?: Difficulty; lang?: string; seed?: number } = {},
): MemoryCard[] | null {
  const skills = resolveSkills(skillIds);
  if (skills.length === 0) return null;
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rnd = mulberry32(seed ^ 0x2545f491);
  const diff = itemDifficulty(opts.difficulty);
  const want = Math.max(pairCount, MIN_MEMORY_PAIRS);

  /* Interleave skills so every chosen skill contributes pairs */
  const perSkill = skills.map((skill) =>
    memoryPairsFromItems(skillItems(skill, want * 6, diff, Math.floor(rnd() * 2 ** 31)), opts.lang ?? 'ro'),
  );
  const picked: MemoryPair[] = [];
  const lefts = new Set<string>();
  const rights = new Set<string>();
  let progressed = true;
  while (picked.length < want && progressed) {
    progressed = false;
    for (const list of perSkill) {
      while (list.length) {
        const p = list.shift()!;
        const lk = p.left.text.toLowerCase();
        const rk = p.right.text.toLowerCase();
        if (lefts.has(lk) || rights.has(rk) || lefts.has(rk) || rights.has(lk)) continue;
        lefts.add(lk);
        rights.add(rk);
        picked.push(p);
        progressed = true;
        break;
      }
      if (picked.length >= want) break;
    }
  }
  if (picked.length < MIN_MEMORY_PAIRS) return null;

  const cards: MemoryCard[] = [];
  picked.forEach((p, i) => {
    const pairId = `p${i}`;
    cards.push({ id: `c${i}a`, pairId, emoji: p.left.text, ...(p.left.picture ? {} : { isText: true }), flipped: false, matched: false });
    cards.push({ id: `c${i}b`, pairId, emoji: p.right.text, ...(p.right.picture ? {} : { isText: true }), flipped: false, matched: false });
  });
  return shuffled(cards, rnd);
}

/* ------------------------------------------------------------------ */
/*  "Can this skill be played in this mode?" (for the picker)         */
/* ------------------------------------------------------------------ */

const usableCache = new Map<string, boolean>();

/**
 * Does the skill produce enough playable material for the mode?
 * Race/sprint: at least 4 items of an allowed type in a sample. Memory: at least 3 pairs.
 * (Text-comprehension skills, made of read-and-answer items, are not.)
 */
export function skillUsable(skillId: string, kind: ItemGameKind): boolean {
  const key = `${skillId}:${kind}`;
  const hit = usableCache.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    if (kind === 'memory') ok = buildItemMemoryCards([skillId], MIN_MEMORY_PAIRS, { seed: 1 }) !== null;
    else ok = buildGameItems([skillId], { count: 4, kind, seed: 1 }).length >= 4;
  } catch {
    ok = false;
  }
  usableCache.set(key, ok);
  return ok;
}
