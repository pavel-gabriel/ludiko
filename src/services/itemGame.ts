/**
 * Item-based multiplayer games (docs/PLAN.md §7, §12): pure helpers, no Firebase, no React.
 *
 * A room whose `settings.skillIds` is non-empty runs on shared `Item`s instead of the v1 `Question`s:
 *  - Race / Sprint: the host generates `Item[]` here, stores them (sanitized) in the RTDB game state
 *    (`game.items`) and every player renders them with `ItemView`.
 *
 * Backward compatibility: rooms without `skillIds` (everything created before v2) keep the v1 generators
 * in `gameEngine.ts`; their game state has `questions` and no `items`, and the pages render by what the
 * game state contains, so an old room state keeps working untouched.
 */
import { getSkill } from '@/engine/content/registry';
import { generateItems, mulberry32 } from '@/engine/items/generators';
import type { Difficulty as ItemDifficulty, Item, ItemType, Skill } from '@/engine/types';
import { getSessionItems } from '@/ui/session/itemSource';
import type { Difficulty, GameSettings } from '@/utils/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** At most this many skills can be mixed in one game */
export const MAX_SKILLS = 5;
/** Item pool for a timed sprint (players answer as many as they can) */
export const ITEM_SPRINT_POOL = 80;
/** Memory is classic picture pairs (the v1 emoji board), never built from items */
export type ItemGameKind = 'race' | 'sprint';

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

/** The item game mode a room's settings describe (memory rooms have none: they always use pictures) */
export function gameKind(settings: Pick<GameSettings, 'gameMode'>): ItemGameKind {
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
/*  "Can this skill be played in this mode?" (for the picker)         */
/* ------------------------------------------------------------------ */

const usableCache = new Map<string, boolean>();

/**
 * Does the skill produce enough playable material for the mode?
 * At least 4 items of an allowed type in a sample.
 * (Text-comprehension skills, made of read-and-answer items, are not.)
 */
export function skillUsable(skillId: string, kind: ItemGameKind): boolean {
  const key = `${skillId}:${kind}`;
  const hit = usableCache.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    ok = buildGameItems([skillId], { count: 4, kind, seed: 1 }).length >= 4;
  } catch {
    ok = false;
  }
  usableCache.set(key, ok);
  return ok;
}
