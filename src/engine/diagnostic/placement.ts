/**
 * Adaptive placement ("Verifică-te") over the prerequisite graph — docs/PLAN.md §6, docs/ENGINE.md.
 *
 * Usage (state is plain JSON — persist it between 3-minute bites to resume):
 *   let st = createPlacement(skills, { grade, semester, subject })
 *   for (let p = nextProbe(st); !p.done; p = nextProbe(st)) {
 *     const results = await askItems(p.skillId, p.itemsWanted)   // boolean[]
 *     st = recordProbe(st, p.skillId, results)
 *   }
 *   const result = placementResult(st)
 */
import type { Grade, Semester, Skill, SkillState, SubjectId } from '../types';
import {
  ancestors,
  buildGraph,
  dependantsOf,
  depths,
  descendants,
  levelFromKey,
  levelKey,
  type Level,
  type SkillGraph,
} from './graph';

export interface PlacementConfig {
  /** Anchor skills probed at the declared level (fewer only if the graph is smaller) */
  minAnchors: number;
  maxAnchors: number;
  /** Items asked per probed skill */
  itemsPerProbe: number;
  /** A probe passes when correct ≥ ceil(passRatio · answered) — default 2 of 3 */
  passRatio: number;
  /** Hard budget: number of skills probed (≈ itemsPerProbe · maxProbes items) */
  maxProbes: number;
  /** Inferred confidence = direct confidence · confidenceDecay^distance */
  confidenceDecay: number;
  /** Inferred "likely mastered" needs at least this confidence; below it the skill stays unknown */
  minConfidence: number;
  /** An anchor already inferred mastered with ≥ this confidence is not probed */
  anchorSkipConfidence: number;
  /** For estimatedWeeks: missions needed per missing skill, and missions per week */
  missionsPerGap: number;
  missionsPerWeek: number;
}

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  minAnchors: 6,
  maxAnchors: 10,
  itemsPerProbe: 3,
  passRatio: 2 / 3,
  maxProbes: 12,
  confidenceDecay: 0.9,
  minConfidence: 0.5,
  anchorSkipConfidence: 0.8,
  missionsPerGap: 3.5,
  missionsPerWeek: 5,
};

export interface ProbeRecord {
  skillId: string;
  results: boolean[];
}

/** Resumable placement state — plain JSON (no Maps, functions or Dates). */
export interface PlacementState {
  version: 1;
  subject: SubjectId;
  /** The child's actual (declared) grade and semester */
  declared: Level;
  /** Highest level that has content and is ≤ declared; null if no content at or below it */
  target: Level | null;
  config: PlacementConfig;
  /** In-scope skills only: subject skills with level ≤ target */
  graph: SkillGraph;
  anchors: string[];
  history: ProbeRecord[];
}

export type NextProbe =
  | { done: false; skillId: string; itemsWanted: number; reason: 'anchor' | 'descend' | 'sweep' }
  | { done: true; reason: 'resolved' | 'budget' | 'empty' };

export type Evidence =
  | { status: 'pass' | 'fail'; confidence: number; correct: number; total: number }
  | { status: 'inferred-pass' | 'inferred-fail'; confidence: number; from: string }
  | { status: 'none'; confidence: 0 };

export interface PlacedSkill {
  state: SkillState;
  /** 0..1 — how sure the placement is about `state` */
  confidence: number;
  /** true when the skill itself was probed */
  observed: boolean;
}

export interface PlacementResult {
  subject: SubjectId;
  declared: Level;
  target: Level | null;
  skillStates: Record<string, PlacedSkill>;
  /** All skills placed as `gap`, foundations first (shallowest prerequisite depth, then level, then id) */
  gaps: string[];
  /** Gaps whose prerequisites are all (likely) mastered — what to teach next */
  frontier: string[];
  /** In-scope skills without enough evidence (budget ran out) */
  unknown: string[];
  /**
   * Highest (grade, semester) such that every in-scope skill at or below it is (likely) mastered.
   * null when even the first semester with content is incomplete.
   */
  level: Level | null;
  missingCount: number;
  estimatedWeeks: number;
  probesUsed: number;
  /** false when the placement stopped on budget or has not finished */
  complete: boolean;
}

/* ------------------------------------------------------------------ */

export function createPlacement(
  skills: Skill[],
  opts: { grade: Grade; semester: Semester; subject: SubjectId },
  config: Partial<PlacementConfig> = {},
): PlacementState {
  const cfg = { ...DEFAULT_PLACEMENT_CONFIG, ...config };
  const declared: Level = { grade: opts.grade, semester: opts.semester };
  const subjectSkills = skills.filter((s) => s.subject === opts.subject && levelKey(s) <= levelKey(declared));
  const targetKey = subjectSkills.length ? Math.max(...subjectSkills.map((s) => levelKey(s))) : -1;
  const graph = buildGraph(subjectSkills);
  return {
    version: 1,
    subject: opts.subject,
    declared,
    target: targetKey < 0 ? null : levelFromKey(targetKey),
    config: cfg,
    graph,
    anchors: pickAnchors(graph, cfg),
    history: [],
  };
}

/**
 * Anchors: greedy set cover over "skill + all its prerequisites" (end-of-chain skills cover the
 * most), ties → higher level, more dependants, id. Then topped up to `minAnchors` with the hubs
 * (most transitive dependants) of the target grade, then of the whole scope.
 * Returned in probe order: highest level first.
 */
export function pickAnchors(graph: SkillGraph, cfg: PlacementConfig = DEFAULT_PLACEMENT_CONFIG): string[] {
  const ids = Object.keys(graph);
  if (!ids.length) return [];
  const deps = dependantsOf(graph);
  const closure = new Map(ids.map((id) => [id, new Set([id, ...ancestors(graph, id).keys()])]));
  const nDesc = new Map(ids.map((id) => [id, descendants(graph, id, deps).size]));
  const lvl = (id: string) => levelKey(graph[id]);
  const byHub = (a: string, b: string) =>
    (nDesc.get(b)! - nDesc.get(a)!) || lvl(b) - lvl(a) || (a < b ? -1 : a > b ? 1 : 0);

  const chosen: string[] = [];
  const covered = new Set<string>();
  while (chosen.length < cfg.maxAnchors) {
    let best: string | null = null;
    let bestGain = 0;
    for (const id of ids) {
      if (chosen.includes(id)) continue;
      let gain = 0;
      for (const c of closure.get(id)!) if (!covered.has(c)) gain++;
      const tieWins = best !== null && (lvl(id) - lvl(best) || -byHub(id, best)) > 0;
      if (gain > bestGain || (gain === bestGain && gain > 0 && tieWins)) {
        best = id;
        bestGain = gain;
      }
    }
    if (!best || bestGain === 0) break;
    chosen.push(best);
    for (const c of closure.get(best)!) covered.add(c);
  }

  const maxLevel = Math.max(...ids.map(lvl));
  const targetGrade = graph[ids.find((id) => lvl(id) === maxLevel)!].grade;
  const fill = (pool: string[]) => {
    for (const id of [...pool].sort(byHub)) {
      if (chosen.length >= Math.min(cfg.minAnchors, cfg.maxAnchors)) return;
      if (!chosen.includes(id)) chosen.push(id);
    }
  };
  fill(ids.filter((id) => graph[id].grade === targetGrade));
  fill(ids);

  const order = new Map(chosen.map((id, i) => [id, i]));
  return chosen.sort((a, b) => lvl(b) - lvl(a) || order.get(a)! - order.get(b)!);
}

/* ------------------------------------------------------------------ */

function passes(correct: number, total: number, cfg: PlacementConfig): boolean {
  return total > 0 && correct >= Math.ceil(cfg.passRatio * total - 1e-9);
}

/** Confidence of a direct observation: 0.5 at a coin-flip ratio, 0.95 at 3/3 or 0/3. */
function directConfidence(correct: number, total: number): number {
  if (!total) return 0;
  return 0.5 + 0.45 * Math.abs((2 * correct) / total - 1);
}

/** Per-skill evidence: direct probes win; otherwise the strongest inference (fail wins ties). */
export function evaluate(state: PlacementState): Record<string, Evidence> {
  const { graph, config: cfg } = state;
  const deps = dependantsOf(graph);
  const observed: Record<string, { correct: number; total: number }> = {};
  for (const h of state.history) {
    const o = (observed[h.skillId] ??= { correct: 0, total: 0 });
    o.correct += h.results.filter(Boolean).length;
    o.total += h.results.length;
  }
  const passInf: Record<string, { c: number; from: string }> = {};
  const failInf: Record<string, { c: number; from: string }> = {};
  for (const id of Object.keys(observed).sort()) {
    const { correct, total } = observed[id];
    const conf = directConfidence(correct, total);
    const pass = passes(correct, total, cfg);
    const reach = pass ? ancestors(graph, id) : descendants(graph, id, deps);
    const target = pass ? passInf : failInf;
    for (const [other, d] of reach) {
      const c = conf * Math.pow(cfg.confidenceDecay, d);
      if (!target[other] || c > target[other].c) target[other] = { c, from: id };
    }
  }
  const out: Record<string, Evidence> = {};
  for (const id of Object.keys(graph)) {
    const o = observed[id];
    if (o && o.total > 0) {
      out[id] = {
        status: passes(o.correct, o.total, cfg) ? 'pass' : 'fail',
        confidence: directConfidence(o.correct, o.total),
        correct: o.correct,
        total: o.total,
      };
    } else if (failInf[id] && failInf[id].c >= (passInf[id]?.c ?? 0)) {
      out[id] = { status: 'inferred-fail', confidence: failInf[id].c, from: failInf[id].from };
    } else if (passInf[id]) {
      out[id] = { status: 'inferred-pass', confidence: passInf[id].c, from: passInf[id].from };
    } else {
      out[id] = { status: 'none', confidence: 0 };
    }
  }
  return out;
}

function isResolved(e: Evidence, cfg: PlacementConfig): boolean {
  return (
    e.status === 'pass' ||
    e.status === 'fail' ||
    e.status === 'inferred-fail' ||
    (e.status === 'inferred-pass' && e.confidence >= cfg.minConfidence)
  );
}

/**
 * Next skill to probe:
 * 1. Descend: for the most recent failed skill that still has unresolved prerequisites, probe the
 *    midpoint of the longest unresolved prerequisite chain below it (binary search on the chain).
 *    Pass → the lower half is inferred mastered; fail → it becomes the new failure to descend from.
 * 2. Otherwise the next anchor not yet settled (observed, inferred gap, or inferred mastered with
 *    ≥ anchorSkipConfidence).
 * 3. Otherwise sweep any in-scope skill still unresolved (highest level first).
 * Stops when everything is resolved or `maxProbes` skills were probed.
 */
export function nextProbe(state: PlacementState): NextProbe {
  const { graph, config: cfg } = state;
  if (!Object.keys(graph).length) return { done: true, reason: 'empty' };
  const pick = pickProbe(state);
  if (!pick) return { done: true, reason: 'resolved' };
  if (state.history.length >= cfg.maxProbes) return { done: true, reason: 'budget' };
  return { done: false, skillId: pick.skillId, itemsWanted: cfg.itemsPerProbe, reason: pick.reason };
}

function pickProbe(state: PlacementState): { skillId: string; reason: 'anchor' | 'descend' | 'sweep' } | null {
  const { graph, config: cfg } = state;
  const ev = evaluate(state);
  const lvl = (id: string) => levelKey(graph[id]);
  const ask = (skillId: string, reason: 'anchor' | 'descend' | 'sweep') => ({ skillId, reason });

  // 1. descend from failures, most recent first
  const failures: string[] = [];
  for (let i = state.history.length - 1; i >= 0; i--) {
    const id = state.history[i].skillId;
    if (ev[id]?.status === 'fail' && !failures.includes(id)) failures.push(id);
  }
  for (const f of failures) {
    const unresolved = new Set([...ancestors(graph, f).keys()].filter((a) => !isResolved(ev[a], cfg)));
    if (!unresolved.size) continue;
    const chain = longestChain(graph, unresolved);
    return ask(chain[Math.floor((chain.length - 1) / 2)], 'descend');
  }

  // 2. anchors
  for (const a of state.anchors) {
    const e = ev[a];
    if (e.status === 'pass' || e.status === 'fail' || e.status === 'inferred-fail') continue;
    if (e.status === 'inferred-pass' && e.confidence >= cfg.anchorSkipConfidence) continue;
    return ask(a, 'anchor');
  }

  // 3. sweep
  const d = depths(graph);
  const rest = Object.keys(graph)
    .filter((id) => !isResolved(ev[id], cfg))
    .sort((a, b) => lvl(b) - lvl(a) || d[b] - d[a] || (a < b ? -1 : 1));
  return rest.length ? ask(rest[0], 'sweep') : null;
}

/** Longest top-down prerequisite chain inside `nodes` (deterministic tie-breaks). */
function longestChain(graph: SkillGraph, nodes: Set<string>): string[] {
  const memo = new Map<string, string[]>();
  const down = (id: string): string[] => {
    const m = memo.get(id);
    if (m) return m;
    let best: string[] = [];
    for (const p of graph[id].prereqs) {
      if (!nodes.has(p)) continue;
      const c = down(p);
      if (c.length > best.length || (c.length === best.length && best.length && pickFirst(graph, c[0], best[0]))) best = c;
    }
    const res = [id, ...best];
    memo.set(id, res);
    return res;
  };
  const hasDependantInside = new Set<string>();
  for (const id of nodes) for (const p of graph[id].prereqs) if (nodes.has(p)) hasDependantInside.add(p);
  let best: string[] = [];
  for (const top of [...nodes].filter((n) => !hasDependantInside.has(n)).sort()) {
    const c = down(top);
    if (c.length > best.length || (c.length === best.length && best.length && pickFirst(graph, c[0], best[0]))) best = c;
  }
  return best;
}

/** Tie-break: higher level first, then smaller id. */
function pickFirst(graph: SkillGraph, a: string, b: string): boolean {
  const d = levelKey(graph[a]) - levelKey(graph[b]);
  return d > 0 || (d === 0 && a < b);
}

export function recordProbe(state: PlacementState, skillId: string, results: boolean[]): PlacementState {
  if (!state.graph[skillId]) throw new Error(`recordProbe: skill "${skillId}" is not in this placement`);
  return { ...state, history: [...state.history, { skillId, results: [...results] }] };
}

/* ------------------------------------------------------------------ */

export function placementResult(state: PlacementState): PlacementResult {
  const { graph, config: cfg } = state;
  const ev = evaluate(state);
  const d = depths(graph);
  const skillStates: Record<string, PlacedSkill> = {};
  for (const id of Object.keys(graph)) {
    const e = ev[id];
    const observed = e.status === 'pass' || e.status === 'fail';
    let st: SkillState = 'unknown';
    if (e.status === 'pass' || (e.status === 'inferred-pass' && e.confidence >= cfg.minConfidence)) st = 'mastered';
    else if (e.status === 'fail' || e.status === 'inferred-fail') st = 'gap';
    skillStates[id] = { state: st, confidence: round3(e.confidence), observed };
  }
  const ids = Object.keys(graph);
  const lvl = (id: string) => levelKey(graph[id]);
  const gaps = ids
    .filter((id) => skillStates[id].state === 'gap')
    .sort((a, b) => d[a] - d[b] || lvl(a) - lvl(b) || (a < b ? -1 : 1));
  const frontier = gaps.filter((id) => graph[id].prereqs.every((p) => skillStates[p].state === 'mastered'));
  const unknown = ids.filter((id) => skillStates[id].state === 'unknown').sort();

  let level: Level | null = null;
  if (ids.length) {
    const keys = [...new Set(ids.map(lvl))].sort((a, b) => a - b);
    for (const k of keys) {
      if (ids.every((id) => lvl(id) > k || skillStates[id].state === 'mastered')) level = levelFromKey(k);
      else break;
    }
  }
  const missingCount = gaps.length;
  return {
    subject: state.subject,
    declared: state.declared,
    target: state.target,
    skillStates,
    gaps,
    frontier,
    unknown,
    level,
    missingCount,
    estimatedWeeks: missingCount ? Math.ceil((missingCount * cfg.missionsPerGap) / cfg.missionsPerWeek) : 0,
    probesUsed: state.history.length,
    complete: !Object.keys(graph).length || pickProbe(state) === null,
  };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
