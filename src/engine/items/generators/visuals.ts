import type { VisualSpec } from '../../types';

/** base10-blocks spec for n (0 < n < 1000). Zero counts are omitted. */
export function blocksSpec(n: number): VisualSpec {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  return {
    kind: 'base10-blocks',
    ...(hundreds ? { hundreds } : {}),
    ...(tens ? { tens } : {}),
    ...(ones ? { ones } : {}),
  };
}

export const objectsSpec = (icon: string, count: number): VisualSpec => ({ kind: 'objects', icon, count });
