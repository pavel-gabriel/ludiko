/** Placement ("Verifică-te") flow over the engine's resumable state. Works inside updateProgress. */
import {
  createPlacement,
  evaluate,
  levelStatement,
  nextProbe,
  placementResult,
  progressFromPlacement,
  recordProbe,
  type PlacementResult,
  type PlacementState,
} from '@/engine/diagnostic';
import { getSkillsBySubject } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import type { ChildProfile, ProfileProgress } from '@/profiles/types';
import type { Level, PlacementDone, PlacementRecord, PlacementSummary, ProbeRequest } from './contract';
import { placementTarget } from './time';

const FIRST_LEVEL: Level = { grade: 0, semester: 1 };

function isEngineState(s: unknown): s is PlacementState {
  const st = s as Partial<PlacementState> | null;
  return !!st && st.version === 1 && typeof st.graph === 'object' && Array.isArray(st.history) && Array.isArray(st.anchors);
}

/** Create a fresh placement record against the profile's target level (see placementTarget). */
export function newPlacementRecord(profile: ChildProfile, subject: SubjectId, now: number): PlacementRecord {
  const target = placementTarget(profile.grade, now);
  const state = createPlacement(getSkillsBySubject(subject), { grade: target.grade, semester: target.semester, subject });
  return { subject, target, state, startedAt: now, updatedAt: now };
}

/**
 * Rough 0..1 progress: probes done / (probes done + anchors still to probe), never 1 before the end.
 * Descents after a failure can add a few probes, so the bar may stall but stays inside [0, 0.95].
 */
export function placementProgress(state: PlacementState): number {
  const done = state.history.length;
  const ev = evaluate(state);
  const cfg = state.config;
  const remainingAnchors = state.anchors.filter((a) => {
    const e = ev[a];
    if (e.status === 'pass' || e.status === 'fail' || e.status === 'inferred-fail') return false;
    if (e.status === 'inferred-pass' && e.confidence >= cfg.anchorSkipConfidence) return false;
    return true;
  }).length;
  const total = Math.min(cfg.maxProbes, done + Math.max(1, remainingAnchors));
  return Math.min(0.95, Math.max(0, done / Math.max(1, total)));
}

export function buildSummary(subject: SubjectId, result: PlacementResult): PlacementSummary {
  // The caller decided the placement is over (resolved or out of budget): never say "not finished"
  const final = { ...result, complete: true };
  return {
    subject,
    level: result.level ?? FIRST_LEVEL,
    gaps: [...result.gaps],
    missingCount: result.missingCount,
    estimatedWeeks: result.estimatedWeeks,
    statement: { ro: levelStatement(final, 'ro'), en: levelStatement(final, 'en') },
  };
}

/** Merge placement-derived records into progress; skills with real mastery evidence are never overwritten. */
export function seedProgress(progress: ProfileProgress, result: PlacementResult, now: number): void {
  for (const [id, seed] of Object.entries(progressFromPlacement(result, now))) {
    const existing = progress.skills[id];
    if (existing && existing.attempts > 0 && existing.state !== 'unknown') continue;
    // keep counters written by placement-mode attempts
    progress.skills[id] = { ...seed, attempts: existing?.attempts ?? 0, correct: existing?.correct ?? 0 };
  }
}

/** Next probe for the stored placement, or finish it (first time: summary, seeding, level history). */
export function advancePlacement(
  progress: ProfileProgress,
  profile: ChildProfile,
  subject: SubjectId,
  now: number,
): ProbeRequest | PlacementDone {
  const placements = (progress.placements ??= {});
  let rec = placements[subject];
  if (rec?.completedAt !== undefined && rec.summary) return { done: true, summary: rec.summary };
  if (!rec || !isEngineState(rec.state)) rec = placements[subject] = newPlacementRecord(profile, subject, now);

  const state = rec.state as PlacementState;
  const next = nextProbe(state);
  if (!next.done) {
    return { done: false, skillId: next.skillId, itemCount: next.itemsWanted, progress: placementProgress(state) };
  }

  const result = placementResult(state);
  const summary = buildSummary(subject, result);
  seedProgress(progress, result, now);
  const history = (progress.levelHistory ??= {});
  history[subject] = [...(history[subject] ?? []), { at: now, level: summary.level, missingCount: summary.missingCount }];
  rec.summary = summary;
  rec.completedAt = now;
  rec.updatedAt = now;
  return { done: true, summary };
}

export function recordPlacementProbe(
  progress: ProfileProgress,
  subject: SubjectId,
  skillId: string,
  results: boolean[],
  now: number,
): void {
  const rec = progress.placements?.[subject];
  if (!rec || !isEngineState(rec.state)) throw new Error(`no placement in progress for "${subject}"`);
  if (rec.completedAt !== undefined) return; // already finished: late answers are ignored
  rec.state = recordProbe(rec.state, skillId, results);
  rec.updatedAt = now;
}
