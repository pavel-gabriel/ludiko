/**
 * Daily bits: a pure split of the stored mission (docs/NOTIFICATIONS.md §1).
 *
 *  Bit  Name       Content
 *  0    warmup     due reviews + an easy practice step
 *  1    island     the `new` step, else the main practice step
 *  2    challenge  a `check` step, else a short practice on a practised skill
 *
 * Every mission step lands in exactly one bit, so finishing all bits finishes the mission and
 * completion needs no storage of its own: a bit is done when its mission steps are. Bits that
 * would be empty are left out (a bit's `index` is its position in the returned list).
 */
import type { Bit, BitKind, BitStep, Mission } from './contract';

/** A bit is 4–6 items; a mastery check keeps the count its skill defines */
export const BIT_MIN_ITEMS = 4;
export const BIT_MAX_ITEMS = 6;
/** Never play fewer than this for one step */
const STEP_MIN_ITEMS = 2;

type Indexed = { step: Mission['steps'][number]; stepIndex: number };

const sum = (steps: BitStep[]) => steps.reduce((n, s) => n + s.itemCount, 0);

/** Shrink the biggest step, or grow the smallest, until the bit is within 4–6 items */
function fitItems(steps: BitStep[]): BitStep[] {
  if (steps.some((s) => s.kind === 'check')) return steps;
  const out = steps.map((s) => ({ ...s }));
  while (sum(out) > BIT_MAX_ITEMS) {
    const biggest = out.reduce((a, b) => (b.itemCount > a.itemCount ? b : a));
    if (biggest.itemCount <= STEP_MIN_ITEMS) break;
    biggest.itemCount -= 1;
  }
  while (sum(out) < BIT_MIN_ITEMS) {
    const smallest = out.reduce((a, b) => (b.itemCount < a.itemCount ? b : a));
    smallest.itemCount += 1;
  }
  return out;
}

export function deriveBits(mission: Mission): Bit[] {
  const all: Indexed[] = mission.steps.map((step, stepIndex) => ({ step, stepIndex }));
  const of = (kind: Mission['steps'][number]['kind']) => all.filter((s) => s.step.kind === kind);

  const reviews = of('review');
  const checks = of('check').slice(0, 1);
  const news = of('new').slice(0, 1);
  const practice = of('practice'); // the planner lists the skills still being learned first

  // island: the new step, else the main (first) practice step
  const island: Indexed[] = news.length ? news : practice.slice(0, 1);
  const rest = news.length ? practice : practice.slice(1);

  // warm-up: the reviews + the easiest (last) remaining practice step
  // challenge: the check, else the remaining practice step the warm-up did not take
  let warmup: Indexed[];
  let challenge: Indexed[];
  if (checks.length) {
    warmup = [...reviews, ...rest];
    challenge = checks;
  } else {
    warmup = [...reviews, ...rest.slice(-1)];
    challenge = rest.slice(0, -1);
  }

  const groups: [BitKind, Indexed[]][] = [
    ['warmup', warmup],
    ['island', island],
    ['challenge', challenge],
  ];

  const bits: Bit[] = [];
  for (const [kind, members] of groups) {
    if (members.length === 0) continue;
    const ordered = [...members].sort((a, b) => a.stepIndex - b.stepIndex);
    const steps = fitItems(
      ordered.map(({ step, stepIndex }) => ({
        stepIndex,
        skillId: step.skillId,
        itemCount: step.itemCount,
        kind: step.kind,
      })),
    );
    bits.push({
      index: bits.length,
      kind,
      day: mission.day,
      steps,
      itemCount: sum(steps),
      done: ordered.every((m) => m.step.done),
    });
  }
  return bits;
}
