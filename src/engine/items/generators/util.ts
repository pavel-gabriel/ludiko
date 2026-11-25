/** Shared helpers for the procedural generators: PRNG, option building, item scaffolding. */
import type { CardContent, ItemBase, LocalizedText, VisualSpec } from '../../types';
import type { GeneratorContext } from './registry';

export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export const chance = (rng: Rng, p: number): boolean => rng() < p;

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function weighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/* ---- params ------------------------------------------------------- */

export function paramInt(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
}

export function paramBool(params: Record<string, unknown>, key: string): boolean | undefined {
  const v = params[key];
  return typeof v === 'boolean' ? v : undefined;
}

export function paramStrings(params: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const v = params[key];
  return Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length > 0 ? (v as string[]) : fallback;
}

/* ---- item scaffolding -------------------------------------------- */

/** Common fields; id/provenance are placeholders replaced by `generateItems`. */
export function baseFields(ctx: GeneratorContext, prompt: LocalizedText, visual?: VisualSpec): Omit<ItemBase, 'type'> {
  return {
    id: '',
    skillId: ctx.skill.id,
    difficulty: ctx.difficulty,
    prompt,
    ...(visual ? { visual } : {}),
    reviewStatus: 'auto-checked',
    provenance: {
      id: '',
      kind: 'item',
      title: '',
      author: 'Ludiko',
      source: 'generated',
      licence: 'OWN',
    },
  };
}

/** Numeric answer options: the correct value plus `total - 1` unique, non-negative distractors (shuffled). */
export function numberOptions(
  rng: Rng,
  correct: number,
  candidates: readonly number[],
  total: number,
  lo = 0,
  hi?: number,
): number[] {
  const out = new Set<number>();
  const ok = (v: number, bound: number | undefined) =>
    Number.isInteger(v) && v >= lo && v !== correct && (bound === undefined || v <= bound);
  const want = total - 1;
  for (const v of shuffle(rng, candidates)) {
    if (out.size >= want) break;
    if (ok(v, hi)) out.add(v);
  }
  for (const bound of [hi, undefined]) {
    for (let k = 1; out.size < want && k < 300; k++) {
      for (const v of [correct + k, correct - k]) if (out.size < want && ok(v, bound)) out.add(v);
    }
  }
  return shuffle(rng, [correct, ...out]);
}

export const numberCards = (values: readonly number[]): CardContent[] =>
  values.map((v) => ({ id: `n${v}`, text: { ro: String(v) } }));

/** Number of options by difficulty: 3 at the easiest level, else 4. */
export const optionCount = (d: number): number => (d <= 1 ? 3 : 4);

export const visualKey = (v: VisualSpec): string => JSON.stringify(v);

export const floorTen = (n: number): number => Math.floor(n / 10) * 10;
export const ceilTen = (n: number): number => Math.ceil(n / 10) * 10;
