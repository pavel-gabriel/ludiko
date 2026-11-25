/** Deterministic shuffle (stable across re-renders for the same seed, so cards never jump around). */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const rnd = mulberry32(hash(seed));
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle, but never return exactly the `forbidden` order (rotates by one if it happens). */
export function seededShuffleAvoiding<T>(arr: readonly T[], seed: string, forbidden: readonly T[]): T[] {
  const out = seededShuffle(arr, seed);
  const same = out.length === forbidden.length && out.every((x, i) => x === forbidden[i]);
  if (same && out.length > 1) out.push(out.shift() as T);
  return out;
}
