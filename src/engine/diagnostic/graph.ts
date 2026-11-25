/**
 * Small, pure helpers over the prerequisite graph (plain JSON so it can live inside resumable state).
 */
import type { Grade, Semester, Skill } from '../types';

export interface GraphNode {
  grade: Grade;
  semester: Semester;
  /** Prerequisites inside this graph only (edges to skills outside the set are dropped) */
  prereqs: string[];
}

export type SkillGraph = Record<string, GraphNode>;

export interface Level {
  grade: Grade;
  semester: Semester;
}

/** Linear order of (grade, semester): 0/1 → 0, 0/2 → 1, I/1 → 2, … */
export const levelKey = (l: Level): number => l.grade * 2 + (l.semester - 1);
export const levelFromKey = (k: number): Level => ({
  grade: Math.floor(k / 2) as Grade,
  semester: ((k % 2) + 1) as Semester,
});

export function buildGraph(skills: Pick<Skill, 'id' | 'grade' | 'semester' | 'prerequisites'>[]): SkillGraph {
  const ids = new Set(skills.map((s) => s.id));
  const g: SkillGraph = {};
  for (const s of [...skills].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    g[s.id] = {
      grade: s.grade,
      semester: s.semester,
      prereqs: s.prerequisites.filter((p) => ids.has(p)).sort(),
    };
  }
  return g;
}

export function dependantsOf(g: SkillGraph): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of Object.keys(g)) out[id] = [];
  for (const [id, n] of Object.entries(g)) for (const p of n.prereqs) out[p].push(id);
  for (const id of Object.keys(out)) out[id].sort();
  return out;
}

/** BFS shortest distance from `start` along `next` edges (start itself excluded). */
export function distances(start: string, next: (id: string) => string[]): Map<string, number> {
  const dist = new Map<string, number>();
  let frontier = [start];
  let d = 0;
  while (frontier.length) {
    d++;
    const nf: string[] = [];
    for (const id of frontier) {
      for (const n of next(id)) {
        if (n === start || dist.has(n)) continue;
        dist.set(n, d);
        nf.push(n);
      }
    }
    frontier = nf;
  }
  return dist;
}

/** Transitive prerequisites with their shortest distance. */
export const ancestors = (g: SkillGraph, id: string) => distances(id, (x) => g[x]?.prereqs ?? []);

/** Transitive dependants with their shortest distance. */
export function descendants(g: SkillGraph, id: string, deps: Record<string, string[]> = dependantsOf(g)) {
  return distances(id, (x) => deps[x] ?? []);
}

/** Length of the longest prerequisite chain below a skill (roots = 0). */
export function depths(g: SkillGraph): Record<string, number> {
  const memo: Record<string, number> = {};
  const visit = (id: string, stack: Set<string>): number => {
    if (memo[id] !== undefined) return memo[id];
    if (stack.has(id)) return 0; // cycle guard (validate.ts rejects cycles anyway)
    stack.add(id);
    const ps = g[id]?.prereqs ?? [];
    const d = ps.length ? 1 + Math.max(...ps.map((p) => visit(p, stack))) : 0;
    stack.delete(id);
    return (memo[id] = d);
  };
  for (const id of Object.keys(g)) visit(id, new Set());
  return memo;
}
