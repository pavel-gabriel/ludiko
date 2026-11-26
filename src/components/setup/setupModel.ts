/**
 * Game setup wizard: pure model (no React, no Firebase).
 *
 * One flow serves three screens: single player (`single`), a new online room (`room`) and the
 * two-players-one-phone duel (`duel`). The wizard collects a `SetupChoices`, and `toRoomSettings` turns it
 * into the room settings the pages hand to `buildRoom` (same shape the old long forms produced).
 */
import { getSkill } from '@/engine/content/registry';
import type { Grade } from '@/engine/types';
import { ADJECTIVES, ANIMALS, type AnimalIdentity } from '@/utils/animalNames';
import { DEFAULT_GAME_SETTINGS } from '@/utils/constants';
import type { Difficulty, GameMode, GameSettings, GameType, Operation, ShapeMode } from '@/utils/types';
import { skillUsable, type ItemGameKind } from '@/services/itemGame';
import { effectiveGameType, skillSettings, PLAY_PRESETS, type PlayPreset } from '@/components/play/presets';

export type SetupContext = 'single' | 'room' | 'duel';
/** "Ce jucăm?": how the game is played */
export type SetupMode = 'race' | 'sprint' | 'memory';
export type SetupStep = 'mode' | 'practice' | 'who' | 'ready';

export const STEPS: readonly SetupStep[] = ['mode', 'practice', 'who', 'ready'];

/** Modes a screen can offer: the sprint is only for online rooms (duel and single player race to the finish) */
export function modesFor(context: SetupContext): SetupMode[] {
  return context === 'room' ? ['race', 'sprint', 'memory'] : ['race', 'memory'];
}

/** v1 games reachable through "Jocul clasic" in race and sprint modes (memory has only its own classic game) */
export const CLASSIC_TYPES: readonly GameType[] = ['mathRace', 'equations', 'countingGame', 'numberSequence', 'shapeMatch'];

export interface SetupChoices {
  mode: SetupMode;
  /** v2 skills (up to MAX_SKILLS); empty with `classic` off means "nothing chosen yet" */
  skillIds: string[];
  /** "Jocul clasic": the v1 generators instead of skills */
  classic: boolean;
  classicType: GameType;
  operations: Operation[];
  shapeMode: ShapeMode;
  difficulty: Difficulty;
  rounds: number;
  timePerRound: number;
  identity: AnimalIdentity;
  /** Duel only */
  identity2: AnimalIdentity;
}

/** What the page needs to build the room */
export interface SetupResult {
  settings: GameSettings;
  identity: AnimalIdentity;
  identity2: AnimalIdentity;
}

export const itemKindOf = (mode: SetupMode): ItemGameKind => (mode === 'memory' ? 'memory' : mode === 'sprint' ? 'sprint' : 'race');

/** The game type that goes into the room: skills only pick race vs memory, the classic game picks its own */
export function gameTypeOf(c: Pick<SetupChoices, 'mode' | 'skillIds' | 'classic' | 'classicType'>): GameType {
  if (c.mode === 'memory') return 'memoryGame';
  if (c.skillIds.length > 0) return effectiveGameType(c.skillIds, 'mathRace');
  return c.classicType;
}

export const isMemory = (c: Pick<SetupChoices, 'mode'>) => c.mode === 'memory';
/** The +, −, ×, ÷ setting applies to the classic math games */
export const showsOperations = (c: Pick<SetupChoices, 'mode' | 'skillIds' | 'classic' | 'classicType'>) =>
  c.mode !== 'memory' && c.skillIds.length === 0 && c.classic && (c.classicType === 'mathRace' || c.classicType === 'equations');
export const showsShapeMode = (c: Pick<SetupChoices, 'mode' | 'skillIds' | 'classic' | 'classicType'>) =>
  c.mode !== 'memory' && c.skillIds.length === 0 && c.classic && c.classicType === 'shapeMatch';

/** Skills chosen that cannot be played in the chosen mode (e.g. text comprehension in a race) */
export function unplayableSkills(c: Pick<SetupChoices, 'mode' | 'skillIds'>): string[] {
  const kind = itemKindOf(c.mode);
  return c.skillIds.filter((id) => !skillUsable(id, kind));
}

/** Step 2 is done once skills or the classic game are chosen (and the choice works in this mode) */
export function practiceIssue(c: SetupChoices): 'none' | 'unplayable' | 'operations' | null {
  if (c.skillIds.length === 0 && !c.classic) return 'none';
  if (unplayableSkills(c).length > 0) return 'unplayable';
  if (showsOperations(c) && c.operations.length === 0) return 'operations';
  return null;
}

/** Step 3 in a duel: the two animals must differ (they are also the avatars) */
export function whoIssue(context: SetupContext, c: Pick<SetupChoices, 'identity' | 'identity2'>): 'sameAvatar' | null {
  if (context === 'duel' && ANIMALS[c.identity.animal]?.emoji === ANIMALS[c.identity2.animal]?.emoji) return 'sameAvatar';
  return null;
}

/** First step that blocks starting, or null: the Start button is only enabled when this is null */
export function firstBlockedStep(context: SetupContext, c: SetupChoices): SetupStep | null {
  if (practiceIssue(c)) return 'practice';
  if (whoIssue(context, c)) return 'who';
  return null;
}

/* ------------------------------------------------------------------ */
/*  Limits (same as the old forms)                                    */
/* ------------------------------------------------------------------ */

export function roundsLimits(context: SetupContext, mode: SetupMode) {
  return mode === 'memory' ? { min: context === 'room' ? 2 : 3, max: 50 } : { min: 5, max: 30 };
}
export function timeLimits(mode: SetupMode) {
  return { min: 5, max: mode === 'memory' || mode === 'sprint' ? 300 : 60 };
}
/** Sensible time default per mode (seconds per round / total for sprint and memory) */
export const TIME_DEFAULT: Record<SetupMode, number> = { race: DEFAULT_GAME_SETTINGS.timePerRound, sprint: 60, memory: 90 };
const clamp = (v: number, { min, max }: { min: number; max: number }) => (!v || v < min ? min : v > max ? max : v);

/** The room settings a finished setup stands for (numbers clamped, nothing `undefined`) */
export function toRoomSettings(context: SetupContext, c: SetupChoices): GameSettings {
  const mathy = showsOperations(c);
  return {
    gameType: gameTypeOf(c),
    gameMode: c.mode === 'sprint' ? 'timedSprint' : ('raceToFinish' as GameMode),
    difficulty: c.difficulty,
    operations: mathy ? c.operations : ['+'],
    rounds: clamp(c.rounds, roundsLimits(context, c.mode)),
    timePerRound: clamp(c.timePerRound, timeLimits(c.mode)),
    ...(showsShapeMode(c) && { shapeMode: c.shapeMode }),
    ...skillSettings(c.skillIds),
  };
}

/* ------------------------------------------------------------------ */
/*  Presets filtered by grade                                         */
/* ------------------------------------------------------------------ */

/** Lowest and highest grade of a preset's skills (null when none of them is in the registry) */
export function presetGrades(p: PlayPreset): { min: Grade; max: Grade } | null {
  const grades = p.skillIds.map((id) => getSkill(id)?.grade).filter((g): g is Grade => g !== undefined);
  if (grades.length === 0) return null;
  return { min: Math.min(...grades) as Grade, max: Math.max(...grades) as Grade };
}

/**
 * Presets for a child of `grade`: those with skills within one grade of it (grade ± 1), the ones covering the grade first. Without a grade
 * (no profile) every preset is returned. If the filter leaves nothing (e.g. a high grade) every preset is
 * returned too, so there is always something to tap.
 */
export function presetsForGrade(grade: Grade | null | undefined, all: readonly PlayPreset[] = PLAY_PRESETS): PlayPreset[] {
  if (grade === null || grade === undefined) return [...all];
  /* how far the preset's grades are from the child's grade (0 = it covers the grade) */
  const gap = (p: PlayPreset) => {
    const g = presetGrades(p);
    return g === null ? Infinity : grade < g.min ? g.min - grade : grade > g.max ? grade - g.max : 0;
  };
  const fit = all.filter((p) => gap(p) <= 1).sort((a, b) => gap(a) - gap(b));
  return fit.length > 0 ? fit : [...all];
}

/** Without a profile: a short, varied first list (maths and Romanian); "Arată toate" opens the rest */
export const STARTER_PRESET_IDS = ['addTo20', 'subTo20', 'mulTable', 'clock', 'syllables', 'wordPictures'];
export function starterPresets(all: readonly PlayPreset[] = PLAY_PRESETS): PlayPreset[] {
  return STARTER_PRESET_IDS.map((id) => all.find((p) => p.id === id)).filter((p): p is PlayPreset => !!p);
}

/* ------------------------------------------------------------------ */
/*  Remembered choices (localStorage, never required)                 */
/* ------------------------------------------------------------------ */

const KEY = (context: SetupContext) => `ludiko.setup.v1.${context}`;

type Remembered = Omit<SetupChoices, 'identity' | 'identity2'> & { identity?: AnimalIdentity; identity2?: AnimalIdentity };

export function saveChoices(context: SetupContext, c: SetupChoices): void {
  try {
    localStorage.setItem(KEY(context), JSON.stringify(c));
  } catch {
    /* private mode / blocked storage: the wizard works without it */
  }
}

const isIdentity = (v: unknown): v is AnimalIdentity => {
  const o = v as AnimalIdentity | null;
  return !!o && Number.isInteger(o.animal) && Number.isInteger(o.adjective)
    && o.animal >= 0 && o.animal < ANIMALS.length && o.adjective >= 0 && o.adjective < ADJECTIVES.length;
};

/** Last choices for this screen, checked field by field (anything odd falls back to `defaults`) */
export function loadChoices(context: SetupContext, defaults: SetupChoices): SetupChoices {
  let raw: Partial<Remembered> | null = null;
  try {
    const text = localStorage.getItem(KEY(context));
    raw = text ? (JSON.parse(text) as Partial<Remembered>) : null;
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return defaults;

  const next: SetupChoices = { ...defaults };
  if (raw.mode && modesFor(context).includes(raw.mode)) next.mode = raw.mode;
  if (Array.isArray(raw.skillIds)) {
    next.skillIds = raw.skillIds.filter((id): id is string => typeof id === 'string' && !!getSkill(id)).slice(0, 5);
  }
  if (typeof raw.classic === 'boolean') next.classic = raw.classic && next.skillIds.length === 0;
  if (raw.classicType && CLASSIC_TYPES.includes(raw.classicType)) next.classicType = raw.classicType;
  if (Array.isArray(raw.operations)) {
    const ops = raw.operations.filter((o): o is Operation => ['+', '-', '×', '÷'].includes(o as string));
    if (ops.length > 0) next.operations = ops;
  }
  if (raw.shapeMode === 'image' || raw.shapeMode === 'word') next.shapeMode = raw.shapeMode;
  if (raw.difficulty === 'easy' || raw.difficulty === 'medium' || raw.difficulty === 'hard') next.difficulty = raw.difficulty;
  if (Number.isFinite(raw.rounds)) next.rounds = clamp(raw.rounds as number, roundsLimits(context, next.mode));
  if (Number.isFinite(raw.timePerRound)) next.timePerRound = clamp(raw.timePerRound as number, timeLimits(next.mode));
  if (isIdentity(raw.identity)) next.identity = raw.identity;
  if (context === 'duel' && isIdentity(raw.identity2) && ANIMALS[raw.identity2.animal].emoji !== ANIMALS[next.identity.animal].emoji) {
    next.identity2 = raw.identity2;
  }
  return next;
}

export function defaultChoices(identity: AnimalIdentity, identity2: AnimalIdentity): SetupChoices {
  return {
    mode: 'race',
    skillIds: [],
    classic: false,
    classicType: DEFAULT_GAME_SETTINGS.gameType,
    operations: [...DEFAULT_GAME_SETTINGS.operations],
    shapeMode: 'image',
    difficulty: DEFAULT_GAME_SETTINGS.difficulty,
    rounds: DEFAULT_GAME_SETTINGS.rounds,
    timePerRound: DEFAULT_GAME_SETTINGS.timePerRound,
    identity,
    identity2,
  };
}
