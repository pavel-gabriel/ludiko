/**
 * Ludiko v2 core content contract — see docs/PLAN.md §5.
 *
 * Shared by: content validators, item renderers, explanation frames, game modes,
 * diagnostic/mastery engines. Change with care: every module depends on it.
 */
import type { Provenance } from './content/provenance';

/* ------------------------------------------------------------------ */
/*  Basics                                                            */
/* ------------------------------------------------------------------ */

/** Romanian is required; English is optional (UI falls back to ro). */
export interface LocalizedText {
  ro: string;
  en?: string;
}

export type SubjectId = 'mat' | 'rom' | 'stiinte' | 'ist' | 'geo' | 'civ' | 'logic' | 'bio' | 'fiz' | 'chim' | 'eng';

/** 0 = clasa pregătitoare … 8 = clasa a VIII-a */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Semester = 1 | 2;
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type ReviewStatus = 'auto-checked' | 'beta' | 'reviewed';

/** Reference to an official competence from a programa version, e.g. { programa: 'MEM-2013', code: '1.4' } */
export interface CompetenceRef {
  programa: string;
  code: string;
}

/* ------------------------------------------------------------------ */
/*  Visuals (rendered as SVG by the visual kit — no raster needed)     */
/* ------------------------------------------------------------------ */

export type VisualSpec =
  | { kind: 'number-line'; from: number; to: number; step?: number; marks?: number[]; jumps?: { from: number; to: number }[] }
  | { kind: 'base10-blocks'; hundreds?: number; tens?: number; ones?: number }
  | { kind: 'clock'; hours: number; minutes: number }
  /** Generic coins/notes drawn by us (never reproductions of real BNR designs). Values in bani. */
  | { kind: 'money'; amounts: number[] }
  /** Count objects: an emoji/icon repeated, optionally in groups (multiplication/division) */
  | { kind: 'objects'; icon: string; count: number; groups?: number }
  | { kind: 'fraction'; numerator: number; denominator: number; shape?: 'circle' | 'bar' }
  /**
   * A geometric figure drawn by us. `sides` (optional) are the side lengths written next to each side,
   * in drawing order (square/rectangle: top, right, bottom, left; triangle: 3 sides). `unit` e.g. 'cm'.
   * `hideSide` (index) shows "?" instead of that length (for perimeter/missing-side questions).
   */
  | {
      kind: 'shape';
      shape: 'triangle' | 'square' | 'rectangle' | 'circle';
      sides?: number[];
      unit?: string;
      hideSide?: number;
    }
  /**
   * A ruler from 0 to `to` in `unit` with an optional object (a coloured bar) lying on it from `from`
   * (default 0) to `objectEnd`. Used for measuring length.
   */
  | { kind: 'ruler'; to: number; unit: 'cm' | 'm'; from?: number; objectEnd?: number; objectLabel?: LocalizedText }
  /**
   * A small grid of symbols drawn by us (logic puzzles: pattern strips, mini-sudoku, robot maps).
   * `cells` is row-major, length rows*cols; each cell holds an emoji / digit / letter, or null = empty
   * (drawn as a dashed "?" box). `highlight` (cell index) marks the cell being asked about.
   * A 4x4 grid also draws the 2x2 box borders (sudoku). A 1-row grid is a "strip" (patterns).
   */
  | { kind: 'grid'; rows: number; cols: number; cells: (string | null)[]; highlight?: number }
  | { kind: 'image'; media: MediaRef };

export interface MediaRef {
  kind: 'image' | 'audio';
  /** Path under public/ or content/media/ */
  src: string;
  alt: LocalizedText;
  /** id of the matching entry in content/credits.json (required for third-party media) */
  provenanceId?: string;
}

/** A card/option shown to the child: text, a visual, or both */
export interface CardContent {
  id: string;
  text?: LocalizedText;
  visual?: VisualSpec;
}

/* ------------------------------------------------------------------ */
/*  Items                                                             */
/* ------------------------------------------------------------------ */

export type ItemType =
  | 'choice'
  | 'picture-choice'
  | 'true-false'
  | 'number-input'
  | 'fill-gap'
  | 'order'
  | 'sort'
  | 'match'
  | 'hotspot'
  | 'read-and-answer'
  | 'listen-and-answer';

export interface ItemBase {
  id: string;
  type: ItemType;
  skillId: string;
  difficulty: Difficulty;
  prompt: LocalizedText;
  /** Optional visual shown with the prompt */
  visual?: VisualSpec;
  /** Optional narration of the prompt (pre-recorded) */
  audio?: MediaRef;
  explanationId?: string;
  reviewStatus: ReviewStatus;
  provenance: Provenance;
}

export interface ChoiceItem extends ItemBase {
  type: 'choice';
  options: CardContent[];
  correctId: string;
}

/** Like choice, but every option must have a visual (for non-readers) */
export interface PictureChoiceItem extends ItemBase {
  type: 'picture-choice';
  options: (CardContent & { visual: VisualSpec })[];
  correctId: string;
}

export interface TrueFalseItem extends ItemBase {
  type: 'true-false';
  correct: boolean;
}

export interface NumberInputItem extends ItemBase {
  type: 'number-input';
  correct: number;
}

/**
 * Sentence/equation with one gap, written as text containing "{{gap}}",
 * e.g. { ro: "{{gap}} + 7 = 15" }. Answer by choosing an option (if given) or typing.
 */
export interface FillGapItem extends ItemBase {
  type: 'fill-gap';
  template: LocalizedText;
  options?: string[];
  correct: string;
}

export interface OrderItem extends ItemBase {
  type: 'order';
  cards: CardContent[];
  /** Card ids in the correct order */
  correctOrder: string[];
}

export interface SortItem extends ItemBase {
  type: 'sort';
  categories: { id: string; label: LocalizedText }[];
  cards: (CardContent & { categoryId: string })[];
}

export interface MatchItem extends ItemBase {
  type: 'match';
  pairs: { left: CardContent; right: CardContent }[];
}

/** Tap the right region of an image; region coordinates are percentages (0–100) */
export interface HotspotItem extends ItemBase {
  type: 'hotspot';
  image: MediaRef;
  regions: { id: string; x: number; y: number; r: number; label?: LocalizedText }[];
  correctId: string;
}

/** Short illustrated text followed by sub-questions */
export interface ReadAndAnswerItem extends ItemBase {
  type: 'read-and-answer';
  passage: LocalizedText;
  questions: (ChoiceItem | TrueFalseItem)[];
}

/** Audio prompt + options (pre-readers) */
export interface ListenAndAnswerItem extends ItemBase {
  type: 'listen-and-answer';
  audio: MediaRef;
  options: CardContent[];
  correctId: string;
}

export type Item =
  | ChoiceItem
  | PictureChoiceItem
  | TrueFalseItem
  | NumberInputItem
  | FillGapItem
  | OrderItem
  | SortItem
  | MatchItem
  | HotspotItem
  | ReadAndAnswerItem
  | ListenAndAnswerItem;

/** What the child answered, per item type */
export type ItemResponse =
  | { type: 'choice' | 'picture-choice' | 'listen-and-answer' | 'hotspot'; selectedId: string }
  | { type: 'true-false'; value: boolean }
  | { type: 'number-input'; value: number }
  | { type: 'fill-gap'; value: string }
  | { type: 'order'; order: string[] }
  | { type: 'sort'; placement: Record<string, string> }
  | { type: 'match'; pairs: Record<string, string> }
  | { type: 'read-and-answer'; answers: Record<string, ItemResponse> };

export interface ItemResult {
  itemId: string;
  correct: boolean;
  response: ItemResponse;
  /** Time from render to answer, ms */
  timeMs: number;
}

/* ------------------------------------------------------------------ */
/*  Explanations ("frames")                                           */
/* ------------------------------------------------------------------ */

export interface Frame {
  text: LocalizedText;
  visual?: VisualSpec;
  audio?: MediaRef;
}

export interface Explanation {
  id: string;
  skillId?: string;
  title: LocalizedText;
  /** 3–4 frames: one idea + one picture each */
  frames: Frame[];
  reviewStatus: ReviewStatus;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/*  Skills                                                            */
/* ------------------------------------------------------------------ */

export type ItemSource =
  /** Procedural generator registered in src/engine/items/generators */
  | { generator: string; params?: Record<string, unknown> }
  /** Static item bank file under content/ */
  | { bank: string };

export interface Skill {
  id: string;
  subject: SubjectId;
  grade: Grade;
  semester: Semester;
  competences: CompetenceRef[];
  title: LocalizedText;
  /** Skill ids that must be mastered first (may be from earlier grades) */
  prerequisites: string[];
  itemSources: ItemSource[];
  explanations: string[];
  masteryCheck: { items: number; minCorrect: number };
  provenance: Provenance;
}

/** Per-child skill state (docs/PLAN.md §4) */
export type SkillState = 'unknown' | 'gap' | 'learning' | 'practised' | 'mastered';

/** Pick the child-facing text for the current UI language (falls back to Romanian) */
export function localize(text: LocalizedText | undefined, lang: string): string {
  if (!text) return '';
  return (lang.startsWith('en') && text.en) || text.ro;
}
