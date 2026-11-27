/**
 * The island route (docs/ENGINE.md "Route"): one ordered path through a subject's skill graph, so the
 * child's map reads as "island 1, island 2, …" and the planner introduces islands one after another.
 *
 * Order = a topological order of the prerequisite graph (every prerequisite before its dependants) that
 * follows (grade, semester) and, inside one level, the order the skills are authored in the content files.
 * Pure and deterministic: same skills (same order) ⇒ same route.
 */
import type { Skill, SkillState } from '../types';
import { levelKey, type Level } from '../diagnostic/graph';
import type { ProgressMap } from '../mastery/types';

type RouteSkill = Pick<Skill, 'id' | 'grade' | 'semester' | 'prerequisites'>;

/**
 * Kahn's algorithm with a priority: among the skills whose prerequisites are already on the route, take the
 * lowest (grade, semester), then the one authored first. Prerequisites outside `skills` are ignored.
 * A cycle (rejected by content validation anyway) never loops: the rest is appended by the same priority.
 */
export function routeOrder(skills: readonly RouteSkill[]): string[] {
  const index = new Map<string, number>();
  skills.forEach((s, i) => {
    if (!index.has(s.id)) index.set(s.id, i);
  });
  const unique = skills.filter((s, i) => index.get(s.id) === i);
  const before = (a: RouteSkill, b: RouteSkill) => levelKey(a) - levelKey(b) || index.get(a.id)! - index.get(b.id)!;
  const waiting = new Map(unique.map((s) => [s.id, new Set(s.prerequisites.filter((p) => index.has(p) && p !== s.id))]));
  const dependants = new Map<string, string[]>(unique.map((s) => [s.id, []]));
  for (const [id, prereqs] of waiting) for (const p of prereqs) dependants.get(p)!.push(id);

  const byId = new Map(unique.map((s) => [s.id, s]));
  const route: string[] = [];
  const placed = new Set<string>();
  const ready = unique.filter((s) => waiting.get(s.id)!.size === 0);
  while (route.length < unique.length) {
    if (ready.length === 0) {
      // cycle guard: take the best remaining skill as if its prerequisites were met
      ready.push(unique.filter((s) => !placed.has(s.id)).sort(before)[0]);
    }
    ready.sort(before);
    const next = ready.shift()!;
    if (placed.has(next.id)) continue;
    placed.add(next.id);
    route.push(next.id);
    for (const d of dependants.get(next.id)!) {
      const w = waiting.get(d)!;
      w.delete(next.id);
      if (w.size === 0 && !placed.has(d)) ready.push(byId.get(d)!);
    }
  }
  return route;
}

/** skillId → position on the route (0-based) */
export function routeIndex(skills: readonly RouteSkill[]): Record<string, number> {
  const out: Record<string, number> = {};
  routeOrder(skills).forEach((id, i) => (out[id] = i));
  return out;
}

const AT_LEAST_PRACTISED: SkillState[] = ['practised', 'mastered'];

export interface NextIslandOptions {
  /** Never-seen skills above this level are not offered (gaps always are) */
  ceiling?: Level;
}

/**
 * Candidates for the planner's `new` step, best first:
 * 1. gap repair: `gap` skills whose prerequisites are all ≥ practised, in route order (foundations first —
 *    the route puts every prerequisite before its dependants);
 * 2. the next islands: never-seen (`unknown`) skills whose prerequisites are all ≥ practised, within the
 *    ceiling, in route order.
 * Islands that are learning/practised/mastered (incl. "already known" from the level check) are not new.
 */
export function newCandidates(skills: readonly RouteSkill[], progress: ProgressMap, opts: NextIslandOptions = {}): string[] {
  const ids = new Set(skills.map((s) => s.id));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const st = (id: string): SkillState => progress[id]?.state ?? 'unknown';
  const ready = (id: string) =>
    byId.get(id)!.prerequisites.every((p) => !ids.has(p) || AT_LEAST_PRACTISED.includes(st(p)));
  const within = (id: string) => !opts.ceiling || levelKey(byId.get(id)!) <= levelKey(opts.ceiling);
  const route = routeOrder(skills);
  return [
    ...route.filter((id) => st(id) === 'gap' && ready(id)),
    ...route.filter((id) => st(id) === 'unknown' && ready(id) && within(id)),
  ];
}

/** The next island on the route: what the planner's `new` step introduces next (undefined: nothing new) */
export function nextIsland(skills: readonly RouteSkill[], progress: ProgressMap, opts: NextIslandOptions = {}): string | undefined {
  return newCandidates(skills, progress, opts)[0];
}
