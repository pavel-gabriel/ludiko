/** "Provocarea zilei": which skills a 5-item mixed test draws from. Pure; the page supplies the registry and progress. */
import type { Skill, SkillState, SubjectId } from '@/engine/types'

export const CHALLENGE_ITEMS = 5

const RANK: Record<SkillState, number> = { mastered: 0, practised: 1, learning: 2, gap: 3, unknown: 3 }

/**
 * One skill per subject while subjects last (mixed across subjects), preferring skills the child has mastered
 * or practised; when there are too few of those, skills at the child's grade or below fill in so a new profile
 * still gets a challenge. Returns up to `n` skills (fewer if the registry has fewer playable ones).
 */
export function pickChallengeSkills(
  skills: readonly Skill[],
  states: Record<string, SkillState | undefined>,
  grade: number,
  n = CHALLENGE_ITEMS,
  rnd: () => number = Math.random,
): Skill[] {
  const usable = skills.filter((s) => s.grade <= grade)
  const bySubject = new Map<SubjectId, Skill[]>()
  for (const s of usable) bySubject.set(s.subject, [...(bySubject.get(s.subject) ?? []), s])
  const rankOf = (s: Skill) => RANK[states[s.id] ?? 'unknown']
  const queues = [...bySubject.values()]
    .map((list) => list.map((s) => ({ s, r: rankOf(s), x: rnd() })).sort((a, b) => a.r - b.r || a.x - b.x).map((e) => e.s))
    .map((q) => ({ q, x: rnd() }))
    .sort((a, b) => a.x - b.x)
    .map((e) => e.q)
  const out: Skill[] = []
  for (let round = 0; out.length < n; round++) {
    let added = false
    for (const q of queues) {
      if (out.length >= n) break
      if (q[round]) {
        out.push(q[round])
        added = true
      }
    }
    if (!added) break
  }
  return out
}
