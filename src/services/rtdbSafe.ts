/**
 * RTDB-safe JSON helpers for item-based game state (kept tiny: imported by gameSession).
 */
import type { Item } from '@/engine/types';

/**
 * Make a value storable in RTDB: no `undefined`/`null`, no NaN/Infinity, no empty arrays/objects
 * (RTDB drops them anyway, so the value read back equals the value written), and no illegal key chars
 * (`. $ # [ ] /`). Pure; returns a new value.
 */
export function sanitizeForRtdb<T>(value: T): T {
  const clean = (v: unknown): unknown => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'string' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) {
      const arr = v.map(clean).filter((x) => x !== undefined);
      return arr.length ? arr : undefined;
    }
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const c = clean(val);
        if (c !== undefined) out[k.replace(/[.$#[\]/]/g, '_')] = c;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return undefined;
  };
  return clean(value) as T;
}

/** Items as read back from RTDB: drop holes (null slots) so a partial snapshot never crashes a renderer */
export function normalizeItems(raw: unknown): Item[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  return list.filter((i): i is Item => !!i && typeof i === 'object' && 'type' in (i as object) && 'id' in (i as object));
}

