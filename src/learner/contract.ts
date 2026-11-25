/**
 * Learner service contract — the ONLY bridge between the learning engine
 * (src/engine/{mastery,diagnostic,planner}) + profile storage (src/profiles) and the UI.
 *
 * UI code imports `learnerService` from '@/learner' and never calls the engine or
 * profileService progress functions directly. See docs/PLAN.md §4 and docs/ENGINE.md.
 */
import type { Grade, Item, ItemResult, ItemType, Semester, SkillState, SubjectId } from '@/engine/types';
import type { MissionStepKind } from './missionKinds';

export type { MissionStepKind };

/* ------------------------------------------------------------------ */
/*  Persisted additions to ProfileProgress (src/profiles/types.ts)     */
/* ------------------------------------------------------------------ */

export interface Level {
  grade: Grade;
  semester: Semester;
}

/** Saved placement for one subject; `state` is the engine's plain-JSON placement state */
export interface PlacementRecord {
  subject: SubjectId;
  /** Level the child was checked against (declared grade, school-calendar semester) */
  target: Level;
  state: unknown;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  summary?: PlacementSummary;
}

export interface PlacementSummary {
  subject: SubjectId;
  level: Level;
  /** Deepest unmet prerequisites first */
  gaps: string[];
  missingCount: number;
  estimatedWeeks: number;
  /** Parent-facing sentence, both languages */
  statement: { ro: string; en: string };
}

export interface LevelHistoryEntry {
  at: number;
  level: Level;
  missingCount: number;
}

export interface MissionStep {
  kind: MissionStepKind;
  skillId: string;
  itemCount: number;
  done: boolean;
  /** Accuracy of the session that completed the step (0..1) */
  accuracy?: number;
}

export interface Mission {
  /** YYYY-MM-DD (local) — one mission per subject per day */
  day: string;
  subject: SubjectId;
  steps: MissionStep[];
  estimatedSeconds: number;
  completedAt?: number;
}

/* ------------------------------------------------------------------ */
/*  Read models for the UI                                            */
/* ------------------------------------------------------------------ */

export interface ProbeRequest {
  done: false;
  skillId: string;
  /** Items to show for this probe (usually 3) */
  itemCount: number;
  /** 0..1 rough progress through the placement, for a progress bar */
  progress: number;
}

export interface PlacementDone {
  done: true;
  summary: PlacementSummary;
}

export interface SkillMapNode {
  skillId: string;
  grade: Grade;
  semester: Semester;
  state: SkillState;
  pMastery: number;
  prerequisites: string[];
  /** Playable now: all prerequisites at least practised */
  unlocked: boolean;
  dueForReview: boolean;
}

export interface ParentSummary {
  profileId: string;
  subjects: {
    subject: SubjectId;
    /** Latest placement summary, if a placement was completed */
    placement?: PlacementSummary;
    /** Skills that became practised/mastered in the last 7 days */
    improved: string[];
    /** Next skills the planner will work on */
    nextUp: string[];
    masteredCount: number;
    totalSkills: number;
  }[];
  /** Number of distinct play days in the last 7 days (gentle streak) */
  playDaysThisWeek: number;
  /** One offline tip for parents, both languages */
  tip: { ro: string; en: string };
}

/* ------------------------------------------------------------------ */
/*  Service                                                           */
/* ------------------------------------------------------------------ */

export interface AttemptMeta {
  /** Second try after an explanation in the same session — counts, but does not move pMastery */
  retry: boolean;
  mode: 'practice' | 'sprint' | 'check' | 'placement';
}

export interface LearnerService {
  /** Semester for a date by the Romanian school calendar (Sep–Jan = 1, Feb–Aug = 2) */
  schoolSemester(now?: number): Semester;

  /** Record one answered item: counters, playDays, and (unless retry/placement) the mastery update */
  recordItemResult(profileId: string, item: Item, result: ItemResult, meta: AttemptMeta): Promise<void>;

  /** Apply a finished mastery check for a skill; returns whether it was passed */
  applyMasteryCheck(
    profileId: string,
    skillId: string,
    results: boolean[],
    itemType: ItemType,
  ): Promise<{ passed: boolean }>;

  /* --- placement ("Verifică-te"), resumable across days --- */
  getPlacement(profileId: string, subject: SubjectId): Promise<PlacementRecord | undefined>;
  /** Start (or resume if one is in progress) and return the next probe or the final result */
  placementNext(profileId: string, subject: SubjectId, now?: number): Promise<ProbeRequest | PlacementDone>;
  /** Record the answers for one probe (true = correct, in order) */
  placementRecord(profileId: string, subject: SubjectId, skillId: string, results: boolean[]): Promise<void>;
  /** Discard a placement so it can be redone */
  resetPlacement(profileId: string, subject: SubjectId): Promise<void>;

  /* --- daily mission --- */
  /** Today's mission (planned once per day and stored); undefined if placement not done yet */
  getTodayMission(profileId: string, subject: SubjectId, now?: number): Promise<Mission | undefined>;
  completeMissionStep(
    profileId: string,
    subject: SubjectId,
    day: string,
    stepIndex: number,
    accuracy: number,
  ): Promise<Mission>;

  /* --- read models --- */
  getSkillMap(profileId: string, subject: SubjectId, now?: number): Promise<SkillMapNode[]>;
  getLevelHistory(profileId: string, subject: SubjectId): Promise<LevelHistoryEntry[]>;
  getParentSummary(profileId: string, now?: number): Promise<ParentSummary>;
}
