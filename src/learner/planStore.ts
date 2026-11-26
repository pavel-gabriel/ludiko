/**
 * Storage for today's plan composition. Only the choice of bits is stored (which subject, which bit of its
 * mission, where the placement stood); done-ness is always derived from the synced mission/placement data.
 * It lives in localStorage, one entry per profile, because ProfileProgress is validated field-by-field by the
 * family-sync rules and a day-long UI choice is not worth widening them. Falls back to memory when
 * localStorage is unavailable (private window, blocked site data).
 */
import type { SubjectId } from '@/engine/types';

export interface StoredPlanBit {
  subject: SubjectId;
  source: 'mission' | 'placement';
  /** source 'mission': position among the subject's bits of the day */
  bitIndex?: number;
  /** source 'placement': probes already answered when the plan was made */
  baseProbes?: number;
}

export interface StoredPlan {
  day: string;
  bits: StoredPlanBit[];
}

const key = (profileId: string) => `ludiko-plan-${profileId}`;
const memory = new Map<string, StoredPlan>();

function valid(v: unknown): v is StoredPlan {
  const p = v as Partial<StoredPlan> | null;
  return (
    !!p &&
    typeof p.day === 'string' &&
    Array.isArray(p.bits) &&
    p.bits.every((b) => b && typeof b.subject === 'string' && (b.source === 'mission' || b.source === 'placement'))
  );
}

export function readStoredPlan(profileId: string): StoredPlan | undefined {
  try {
    const raw = localStorage.getItem(key(profileId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (valid(parsed)) return parsed;
    }
  } catch {
    /* fall through to memory */
  }
  return memory.get(profileId);
}

export function writeStoredPlan(profileId: string, plan: StoredPlan): void {
  memory.set(profileId, plan);
  try {
    localStorage.setItem(key(profileId), JSON.stringify(plan));
  } catch {
    /* memory copy stays */
  }
}

/** Forget the stored plan (tests, profile restore) */
export function clearStoredPlan(profileId: string): void {
  memory.delete(profileId);
  try {
    localStorage.removeItem(key(profileId));
  } catch {
    /* ignore */
  }
}
