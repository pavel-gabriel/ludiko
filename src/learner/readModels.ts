/** Read models for the UI: skill map and parent summary (no writes). */
import { isDue } from '@/engine/mastery';
import { nextIsland, routeIndex } from '@/engine/planner';
import { getAllSkills, getSkillsBySubject } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import { toDayString } from '@/profiles/profileService';
import type { ChildProfile, ProfileProgress, SkillProgress } from '@/profiles/types';
import type { Level, ParentSummary, SkillMapNode } from './contract';
import { findMission, planDay } from './missionOps';
import { tipForWeek } from './tips';
import { DAY_MS, lastDays } from './time';

/** Mastered by the level check and not practised since (placement seeding never stamps `stateChangedAt`) */
export function knownFromCheck(rec: SkillProgress | undefined): boolean {
  return rec?.state === 'mastered' && rec.stateChangedAt === undefined;
}

/**
 * The subject's islands in ROUTE order (src/engine/planner/route.ts), with the next island flagged: the one
 * the planner's `new` step introduces next (gap repair first, else the first unlocked never-seen island
 * within `ceiling`). Without a ceiling every never-seen island counts.
 */
export function buildSkillMap(
  progress: ProfileProgress,
  subject: SubjectId,
  now: number,
  opts: { ceiling?: Level } = {},
): SkillMapNode[] {
  const all = getSkillsBySubject(subject);
  const order = routeIndex(all);
  const skills = [...all].sort((a, b) => order[a.id] - order[b.id]);
  const known = new Set(skills.map((s) => s.id));
  const playable = (id: string) => {
    const st = progress.skills[id]?.state;
    return st === 'practised' || st === 'mastered';
  };
  const next = nextIsland(all, progress.skills, { ceiling: opts.ceiling });
  return skills.map((s) => {
    const rec = progress.skills[s.id];
    return {
      skillId: s.id,
      grade: s.grade,
      semester: s.semester,
      state: rec?.state ?? 'unknown',
      pMastery: rec?.pMastery ?? 0,
      prerequisites: [...s.prerequisites],
      // prerequisites outside the content set cannot be played, so they do not lock anything
      unlocked: s.prerequisites.every((p) => !known.has(p) || playable(p)),
      dueForReview: rec?.state === 'mastered' && isDue(rec, now),
      route: order[s.id],
      known: knownFromCheck(rec),
      next: s.id === next,
    };
  });
}

const NEXT_KIND_ORDER = { new: 0, check: 1, practice: 2, review: 3 } as const;

/** Skills the planner will work on next: today's unfinished stored mission, else a fresh (unsaved) plan. */
export function nextUpSkills(progress: ProfileProgress, profile: ChildProfile, subject: SubjectId, now: number): string[] {
  if (progress.placements?.[subject]?.completedAt === undefined) return [];
  const stored = findMission(progress, subject, toDayString(now));
  const open = stored?.steps.filter((s) => !s.done);
  const steps = open && open.length ? open : planDay(progress, profile, subject, now).steps;
  return [...steps]
    .sort((a, b) => NEXT_KIND_ORDER[a.kind] - NEXT_KIND_ORDER[b.kind])
    .map((s) => s.skillId)
    .filter((id, i, all) => all.indexOf(id) === i)
    .slice(0, 3);
}

export function buildParentSummary(progress: ProfileProgress, profile: ChildProfile, now: number): ParentSummary {
  const weekAgo = now - 7 * DAY_MS;
  const subjects = [...new Set(getAllSkills().map((s) => s.subject))].sort();
  const week = new Set(lastDays(now, 7, toDayString));
  return {
    profileId: profile.id,
    subjects: subjects.map((subject) => {
      const skills = getSkillsBySubject(subject);
      const improved = skills
        .filter((s) => {
          const r = progress.skills[s.id];
          return (
            !!r &&
            (r.state === 'practised' || r.state === 'mastered') &&
            r.stateChangedAt !== undefined &&
            r.stateChangedAt > weekAgo &&
            r.stateChangedAt <= now
          );
        })
        .sort((a, b) => progress.skills[b.id]!.stateChangedAt! - progress.skills[a.id]!.stateChangedAt! || (a.id < b.id ? -1 : 1))
        .map((s) => s.id);
      return {
        subject,
        placement: progress.placements?.[subject]?.summary,
        improved,
        nextUp: nextUpSkills(progress, profile, subject, now),
        masteredCount: skills.filter((s) => progress.skills[s.id]?.state === 'mastered').length,
        totalSkills: skills.length,
      };
    }),
    playDaysThisWeek: progress.playDays.filter((d) => week.has(d)).length,
    tip: tipForWeek(now),
  };
}
