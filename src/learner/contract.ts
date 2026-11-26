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

/**
 * placementNext answer for a subject with nothing to check at the child's grade (e.g. geography for a
 * grade I child: its content starts in grade IV). No placement is created or completed.
 */
export interface PlacementUnavailable {
  done: false;
  unavailable: true;
  /** Grade the subject's content starts at (undefined: no content at all) */
  minGrade: Grade | undefined;
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

/* --- daily bits (docs/NOTIFICATIONS.md §1) --- */

export type BitKind = 'warmup' | 'island' | 'challenge';

export interface BitStep {
  /** Index of the stored mission step this part of the bit completes (use with completeMissionStep) */
  stepIndex: number;
  skillId: string;
  /** Items to play for this part (a bit is 4–6 items; a mastery check keeps its own count) */
  itemCount: number;
  kind: MissionStepKind;
}

/** A ~3-minute slice of today's stored mission, small enough for a short attention span */
export interface Bit {
  /** Position in today's list of bits (0-based); the route is /learn/bit/:subject/:index */
  index: number;
  kind: BitKind;
  /** Mission day (YYYY-MM-DD) the steps belong to */
  day: string;
  steps: BitStep[];
  /** Sum of the steps' itemCount */
  itemCount: number;
  /** All of the bit's mission steps are done */
  done: boolean;
}

/* --- class assignments (docs/CLASSROOM.md §4): an extra bit, "Tema de la clasă" --- */

/** One assigned skill with the child's own state; done = practised or mastered */
export interface AssignmentSkill {
  skillId: string;
  state: SkillState;
  done: boolean;
}

/** A teacher's assignment as the child sees it on /learn. Done-ness is derived from skill states, never stored. */
export interface AssignmentBit {
  kind: 'assignment';
  assignmentId: string;
  title: string;
  subject: SubjectId;
  /** YYYY-MM-DD */
  dueDay: string;
  /** Whole local days until dueDay: 0 = today, negative = past due */
  daysLeft: number;
  skills: AssignmentSkill[];
  doneCount: number;
  total: number;
  done: boolean;
  /** Not done and past the due day (shown gently: "you can still do it") */
  overdue: boolean;
}

/* --- daily plan across subjects ("Biții de azi", docs/NOTIFICATIONS.md §1) --- */

/** Items of one placement chunk, as shown to the child (2 probes of ~3 items = about 3 minutes) */
export const PLAN_CHECK_ITEMS = 6;

/**
 * One bit of today's plan. `index` is the position in the plan (0-based). For `source: 'mission'` the rest
 * is the subject's own Bit (steps, kind, done) and `bitIndex` is its position in getTodayBits(subject), so
 * the route is /learn/bit/:subject/:bitIndex?plan=1 and completion is completeMissionStep as usual.
 * For `source: 'placement'` the subject has no finished placement yet: the bit is a short chunk of it
 * ("Hai să vedem ce știi!", 2 probes), played at /learn/check/:subject?plan=1; `kind` is a placeholder
 * ('island'), `steps` is empty and `done` means the chunk (or the whole placement) is finished.
 */
export type PlanBit = Bit & {
  subject: SubjectId;
  source: 'mission' | 'placement';
  bitIndex?: number;
};

/** The child's plan for one local day: about 3 bits (Matematică, Limba română, a rotating subject) */
export interface TodayPlan {
  /** YYYY-MM-DD (local) */
  day: string;
  bits: PlanBit[];
}

export interface LearnerService {
  /**
   * Today's plan across subjects: Bit 1 Matematică, Bit 2 Limba română, Bit 3 a subject that rotates by day
   * from the child's available others (stiinte, logic, ist, geo, civ), preferring one with a placement still
   * to do, due reviews or gaps. Only subjects at or below the child's grade appear. Each bit is a slice of
   * that subject's stored mission, or a placement chunk when the subject has no finished placement. Composed
   * once per day and stored on this device, so re-reads give the same bits; `done` is derived from the
   * mission steps / placement probes, never stored. Offline, no network.
   */
  getTodayPlan(profileId: string, now?: number): Promise<TodayPlan>;

  /**
   * Today's bits (1–3), derived from the stored mission: stable for the day, offline too.
   * Completing a bit = completeMissionStep for each of its steps. undefined if no placement yet.
   */
  getTodayBits(profileId: string, subject: SubjectId, now?: number): Promise<Bit[] | undefined>;

  /** Semester for a date by the Romanian school calendar (Sep–Jan = 1, Feb–Aug = 2) */
  schoolSemester(now?: number): Semester;

  /** Record one answered item: counters, playDays, and (unless retry/placement) the mastery update */
  recordItemResult(profileId: string, item: Item, result: ItemResult, meta: AttemptMeta): Promise<void>;

  /**
   * A finished exam simulation (src/exam): feeds every answered item into mastery in ONE write, as if
   * practised once (docs/EXAM_PRACTICE.md §5). Per-item calls with mode 'check' only keep the play-day streak.
   */
  recordExamResults(profileId: string, entries: { item: Item; correct: boolean }[]): Promise<void>;

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
  placementNext(
    profileId: string,
    subject: SubjectId,
    now?: number,
  ): Promise<ProbeRequest | PlacementDone | PlacementUnavailable>;
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

  /**
   * Assignments from the child's class, from the locally cached copy (works offline; refreshed in the
   * background by src/classroom/syncGate). Empty when the profile has no classLink. Open ones first.
   */
  getClassAssignments(profileId: string, now?: number): Promise<AssignmentBit[]>;
}
