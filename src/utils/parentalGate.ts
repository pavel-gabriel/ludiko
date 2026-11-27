/**
 * Parental gate challenge ("ask an adult: what is 7 x 8?").
 * Required before external links, mailto and purchases in the Kids Category
 * (Apple 1.3 / 5.1.4) and Google Play Families policy. See store/ios/README.md.
 * Pure and rng-injectable so it can be unit-tested.
 */
export interface GateChallenge {
  a: number
  b: number
  answer: number
  /** 4 distinct options including the answer, shuffled */
  options: number[]
}

export function makeGateChallenge(rng: () => number = Math.random): GateChallenge {
  const pick = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
  const a = pick(6, 9)
  const b = pick(6, 9)
  const answer = a * b
  const wrong = new Set<number>()
  // plausible distractors: neighbouring products and off-by-one results
  const pool = [answer + a, answer - a, answer + b, answer - b, answer + 10, answer - 10, answer + 1, answer - 1]
  let guard = 0
  while (wrong.size < 3 && guard++ < 200) {
    const c = pool[Math.floor(rng() * pool.length)]
    if (c !== answer && c > 0) wrong.add(c)
  }
  // deterministic fallback so a degenerate rng can never leave fewer than 4 options
  for (let k = 2; wrong.size < 3; k++) wrong.add(answer + 10 * k)
  const options = [answer, ...wrong]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return { a, b, answer, options }
}
