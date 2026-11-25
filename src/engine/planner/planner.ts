/**
 * Daily mission planner (docs/PLAN.md §4 step 3, §6 "Mission planner").
 * Pure and deterministic: same skills + progress + now ⇒ same mission.
 */
import type { Skill, SkillState, SubjectId } from '../types';
import { buildGraph, depths, levelKey, type Level } from '../diagnostic/graph';
import { isDue, isReadyForCheck } from '../mastery/bkt';
import { DEFAULT_MASTERY_CONFIG, type MasteryConfig, type MasteryRecord, type ProgressMap } from '../mastery/types';

export type StepKind = 'new' | 'practice' | 'review' | 'check';

export interface MissionStep {
  kind: StepKind;
  skillId: string;
  itemCount: number;
}

export interface Mission {
  createdAt: number;
  steps: MissionStep[];
  totalItems: number;
  /** items · secondsPerItem (+ explanation time for a `new` step) */
  estimatedSeconds: number;
}

export interface PlannerConfig {
  /** Average time per item, seconds (young children: 20–30 s) */
  secondsPerItem: number;
  /** Extra time for the micro-explanation that opens a `new` step */
  explanationSeconds: number;
  newItems: number;
  practiceItems: number;
  reviewItems: number;
  maxNew: number;
  maxPractice: number;
  maxReviews: number;
  /** Shrinking floor and top-up ceiling per step */
  minItemsPerStep: number;
  maxItemsPerStep: number;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  secondsPerItem: 25,
  explanationSeconds: 60,
  newItems: 6,
  practiceItems: 5,
  reviewItems: 3,
  maxNew: 1,
  maxPractice: 2,
  maxReviews: 2,
  minItemsPerStep: 2,
  maxItemsPerStep: 10,
};

export interface PlanOptions {
  /** epoch ms — decides which reviews are due */
  now: number;
  /** Time budget, default 10 */
  minutes?: number;
  /** Only plan skills of this subject (default: all given skills) */
  subject?: SubjectId;
  /** Never introduce never-seen (`unknown`) skills above this level; gaps are always eligible */
  ceiling?: Level;
  config?: Partial<PlannerConfig>;
  mastery?: MasteryConfig;
}

const AT_LEAST_PRACTISED: SkillState[] = ['practised', 'mastered'];

/**
 * Selection (each skill appears at most once):
 * - review:   up to 2 `mastered` skills whose spaced review is due (most overdue first)
 * - new:      at most 1 `gap` (else never-seen) skill whose prerequisites are all ≥ practised,
 *             foundations first (shallowest prerequisite depth, then lowest level)
 * - check:    1 practised skill ready for its mastery check (`isReadyForCheck`)
 * - practice: 1–2 `learning`/`practised` skills (learning first, then due, then least recently seen)
 * Review/practice/check never pick a skill that has a prerequisite in state `gap`.
 * Budget: floor((minutes·60 − explanation) / secondsPerItem) items; steps are added in priority
 * order review₁ → new → check → practice₁ → review₂ → practice₂ (shrinking to minItemsPerStep
 * when tight), then leftover budget tops up practice/new steps up to maxItemsPerStep.
 * Presented order: review₁, check, new, practice₁, review₂, practice₂ (no skill twice in a row).
 */
export function planMission(skills: Skill[], progress: ProgressMap, opts: PlanOptions): Mission {
  const cfg = { ...DEFAULT_PLANNER_CONFIG, ...opts.config };
  const mcfg = opts.mastery ?? DEFAULT_MASTERY_CONFIG;
  const pool = opts.subject ? skills.filter((s) => s.subject === opts.subject) : skills;
  const byId = new Map(pool.map((s) => [s.id, s]));
  const graph = buildGraph(pool);
  const depth = depths(graph);
  const ids = Object.keys(graph);
  const rec = (id: string): MasteryRecord | undefined => progress[id];
  const st = (id: string): SkillState => rec(id)?.state ?? 'unknown';
  const foundation = (a: string, b: string) =>
    depth[a] - depth[b] || levelKey(graph[a]) - levelKey(graph[b]) || (a < b ? -1 : a > b ? 1 : 0);
  const noGapPrereq = (id: string) => graph[id].prereqs.every((p) => st(p) !== 'gap');
  const prereqsReady = (id: string) => graph[id].prereqs.every((p) => AT_LEAST_PRACTISED.includes(st(p)));
  const used = new Set<string>();
  const take = (list: string[], n: number) => {
    const out = list.filter((id) => !used.has(id)).slice(0, n);
    out.forEach((id) => used.add(id));
    return out;
  };

  const checks = take(
    ids
      .filter((id) => isReadyForCheck(rec(id), mcfg) && noGapPrereq(id))
      .sort((a, b) => rec(b)!.pMastery - rec(a)!.pMastery || foundation(a, b)),
    1,
  );
  const reviews = take(
    ids
      .filter((id) => st(id) === 'mastered' && isDue(rec(id), opts.now, mcfg) && noGapPrereq(id))
      .sort((a, b) => rec(a)!.nextReview! - rec(b)!.nextReview! || foundation(a, b)),
    cfg.maxReviews,
  );
  const withinCeiling = (id: string) => !opts.ceiling || levelKey(graph[id]) <= levelKey(opts.ceiling);
  const newOnes = take(
    [
      ...ids.filter((id) => st(id) === 'gap' && prereqsReady(id)).sort(foundation),
      ...ids.filter((id) => st(id) === 'unknown' && prereqsReady(id) && withinCeiling(id)).sort(foundation),
    ],
    cfg.maxNew,
  );
  const practice = take(
    ids
      .filter((id) => (st(id) === 'learning' || st(id) === 'practised') && noGapPrereq(id))
      .sort(
        (a, b) =>
          Number(st(b) === 'learning') - Number(st(a) === 'learning') ||
          Number(isDue(rec(b), opts.now, mcfg)) - Number(isDue(rec(a), opts.now, mcfg)) ||
          rec(a)!.lastSeen - rec(b)!.lastSeen ||
          foundation(a, b),
      ),
    cfg.maxPractice,
  );
  // Nothing to do today: offer the earliest upcoming reviews (keeps the habit, no interval gain).
  if (!checks.length && !reviews.length && !newOnes.length && !practice.length) {
    reviews.push(
      ...take(
        ids
          .filter((id) => st(id) === 'mastered' && noGapPrereq(id))
          .sort((a, b) => (rec(a)!.nextReview ?? 0) - (rec(b)!.nextReview ?? 0) || foundation(a, b)),
        cfg.maxReviews,
      ),
    );
  }

  // ---- budget ----
  const minutes = opts.minutes ?? 10;
  let budget = Math.floor((minutes * 60 - (newOnes.length ? cfg.explanationSeconds : 0)) / cfg.secondsPerItem);
  const chosen = new Map<string, MissionStep>();
  const add = (kind: StepKind, skillId: string | undefined, want: number, shrinkable: boolean) => {
    if (!skillId) return;
    const n = Math.min(want, budget);
    if (n < (shrinkable ? Math.min(cfg.minItemsPerStep, want) : want) || n <= 0) return;
    chosen.set(skillId, { kind, skillId, itemCount: n });
    budget -= n;
  };
  add('review', reviews[0], cfg.reviewItems, true);
  add('new', newOnes[0], cfg.newItems, true);
  const ck = checks[0];
  add('check', ck, ck ? byId.get(ck)!.masteryCheck.items : 0, false);
  add('practice', practice[0], cfg.practiceItems, true);
  add('review', reviews[1], cfg.reviewItems, true);
  add('practice', practice[1], cfg.practiceItems, true);

  // top up: practice steps, then the new step, round-robin, one item at a time
  const growable = [...chosen.values()].filter((s) => s.kind === 'practice' || s.kind === 'new');
  growable.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'practice' ? -1 : 1));
  let grew = true;
  while (budget > 0 && grew) {
    grew = false;
    for (const s of growable) {
      if (budget <= 0) break;
      if (s.itemCount < cfg.maxItemsPerStep) {
        s.itemCount++;
        budget--;
        grew = true;
      }
    }
  }

  const order = [reviews[0], ck, newOnes[0], practice[0], reviews[1], practice[1]];
  const steps = order.filter((id): id is string => !!id && chosen.has(id)).map((id) => chosen.get(id)!);
  const totalItems = steps.reduce((n, s) => n + s.itemCount, 0);
  return {
    createdAt: opts.now,
    steps,
    totalItems,
    estimatedSeconds: totalItems * cfg.secondsPerItem + (steps.some((s) => s.kind === 'new') ? cfg.explanationSeconds : 0),
  };
}
