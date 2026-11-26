import type { PlanBit } from '@/learner'

/** Route that plays a bit of today's plan; `?plan=1` makes the screens continue with the rest of the plan */
export function planBitPath(bit: Pick<PlanBit, 'subject' | 'source' | 'bitIndex'>): string {
  return bit.source === 'mission'
    ? `/learn/bit/${bit.subject}/${bit.bitIndex ?? 0}?plan=1`
    : `/learn/check/${bit.subject}?plan=1`
}

/** The next bit still to do after position `after` (wrapping to the start), or undefined when all are done */
export function nextPlanBit(bits: PlanBit[], after: number): PlanBit | undefined {
  const pending = bits.filter((b) => !b.done && b.index !== after)
  return pending.find((b) => b.index > after) ?? pending[0]
}
