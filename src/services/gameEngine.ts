import type { Difficulty, Operation, Question, ShapeQuestion, MemoryCard } from '@/utils/types';
import { DIFFICULTY_RANGES, SHAPES, MEMORY_EMOJIS, COUNTING_EMOJIS } from '@/utils/constants';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uid(): string {
  return Math.random().toString(36).substring(2, 8);
}

/* ------------------------------------------------------------------ */
/*  Math question generation                                          */
/* ------------------------------------------------------------------ */

function computeAnswer(a: number, b: number, op: Operation): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return Math.round(a / b);
  }
}

function generateOperands(
  difficulty: Difficulty,
  operation: Operation,
): { a: number; b: number } {
  const { min, max } = DIFFICULTY_RANGES[difficulty];

  if (operation === '÷') {
    /* Keep the dividend within the difficulty range: pick b, then a
       quotient small enough that a = b × quotient stays <= max */
    const b = randomInt(Math.max(min, 2), Math.min(max, 12));
    const maxQuotient = Math.max(1, Math.floor(max / b));
    const quotient = randomInt(1, maxQuotient);
    return { a: b * quotient, b };
  }

  if (operation === '-') {
    const a = randomInt(min, max);
    const b = randomInt(min, a);
    return { a, b };
  }

  if (operation === '×') {
    const limit = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 12 : max;
    return { a: randomInt(min, limit), b: randomInt(min, limit) };
  }

  return { a: randomInt(min, max), b: randomInt(min, max) };
}

function generateWrongAnswers(correct: number, count: number): number[] {
  const wrongs = new Set<number>();
  const range = Math.max(5, Math.abs(correct));

  while (wrongs.size < count) {
    const offset = randomInt(1, range);
    const wrong = Math.round(correct + (Math.random() > 0.5 ? offset : -offset));
    if (wrong !== correct && wrong >= 0) {
      wrongs.add(wrong);
    }
  }

  return [...wrongs];
}

/** Generate a single math question */
export function generateQuestion(
  difficulty: Difficulty,
  operations: Operation[],
): Question {
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const { a, b } = generateOperands(difficulty, operation);
  const correctAnswer = computeAnswer(a, b, operation);

  const wrongAnswers = generateWrongAnswers(correctAnswer, 3);
  const options = shuffle([correctAnswer, ...wrongAnswers]);

  return { id: uid(), a, b, operation, correctAnswer, options };
}

/** Check if an answer is correct */
export function checkAnswer(question: Question, answer: number): boolean {
  return answer === question.correctAnswer;
}

/* ------------------------------------------------------------------ */
/*  Counting question generation                                      */
/* ------------------------------------------------------------------ */

/**
 * Wrong answers close to the correct one (±1..3) so players must
 * actually count/compute rather than eliminate absurd options.
 */
function generateCloseWrongAnswers(correct: number, count: number, minValue = 0): number[] {
  const wrongs = new Set<number>();
  let spread = 3;
  while (wrongs.size < count) {
    const offset = randomInt(1, spread);
    const wrong = correct + (Math.random() > 0.5 ? offset : -offset);
    if (wrong !== correct && wrong >= minValue) wrongs.add(wrong);
    /* Widen the spread if we can't find enough close values (e.g. correct=0) */
    spread++;
  }
  return [...wrongs];
}

/**
 * Generate a counting question: "How many 🍎?" with an emoji group.
 * Easy: 1-5 of one emoji. Medium: 3-10. Hard: 4-12 mixed with distractor emojis.
 */
export function generateCountingQuestion(difficulty: Difficulty): Question {
  const [min, max] =
    difficulty === 'easy' ? [1, 5] : difficulty === 'medium' ? [3, 10] : [4, 12];
  const count = randomInt(min, max);

  const pool = shuffle(COUNTING_EMOJIS);
  const target = pool[0];
  let emojis: string[] = Array(count).fill(target);

  /* Hard: mix in distractor emojis the player must NOT count */
  if (difficulty === 'hard') {
    const distractor = pool[1];
    const distractorCount = randomInt(2, 5);
    emojis = shuffle([...emojis, ...Array(distractorCount).fill(distractor)]);
  }

  const options = shuffle([count, ...generateCloseWrongAnswers(count, 3, 0)]);

  return {
    id: uid(),
    a: count,
    b: 0,
    operation: '+',
    correctAnswer: count,
    options,
    kind: 'counting',
    emojis,
    targetEmoji: target,
  };
}

/* ------------------------------------------------------------------ */
/*  Number sequence question generation                               */
/* ------------------------------------------------------------------ */

/**
 * Generate a missing-number question over an arithmetic sequence,
 * e.g. "2, 4, ?, 8, 10". Difficulty controls start/step ranges;
 * hard sequences may descend.
 */
export function generateSequenceQuestion(difficulty: Difficulty): Question {
  const step =
    difficulty === 'easy' ? randomInt(1, 2) : difficulty === 'medium' ? randomInt(2, 5) : randomInt(2, 9);
  const start =
    difficulty === 'easy' ? randomInt(0, 10) : difficulty === 'medium' ? randomInt(0, 20) : randomInt(0, 50);
  const descending = difficulty === 'hard' && Math.random() > 0.5;

  const LENGTH = 5;
  const terms = Array.from({ length: LENGTH }, (_, i) =>
    descending ? start + (LENGTH - 1 - i) * step : start + i * step,
  );

  /* Hide an inner term so context exists on both sides */
  const missingIndex = randomInt(1, LENGTH - 2);
  const correctAnswer = terms[missingIndex];
  const prompt = terms.map((v, i) => (i === missingIndex ? '?' : String(v))).join(', ');

  /* Plausible wrongs: off-by-step and off-by-one mistakes */
  const wrongs = new Set<number>();
  for (const candidate of [
    correctAnswer + step,
    correctAnswer - step,
    correctAnswer + 1,
    correctAnswer - 1,
    correctAnswer + 2 * step,
  ]) {
    if (wrongs.size < 3 && candidate !== correctAnswer && candidate >= 0) wrongs.add(candidate);
  }
  for (const extra of generateCloseWrongAnswers(correctAnswer, 3, 0)) {
    if (wrongs.size < 3 && !wrongs.has(extra)) wrongs.add(extra);
  }

  const options = shuffle([correctAnswer, ...wrongs]);

  return {
    id: uid(),
    a: start,
    b: step,
    operation: '+',
    correctAnswer,
    options,
    kind: 'sequence',
    prompt,
  };
}

/**
 * Generate one question for any numeric game type.
 * Math Race uses operations; Counting/Sequence only use difficulty.
 */
export function generateNumericQuestion(
  gameType: string,
  difficulty: Difficulty,
  operations: Operation[],
): Question {
  if (gameType === 'countingGame') return generateCountingQuestion(difficulty);
  if (gameType === 'numberSequence') return generateSequenceQuestion(difficulty);
  return generateQuestion(difficulty, operations);
}

/* ------------------------------------------------------------------ */
/*  Shape question generation                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a shape question: "Tap the [shape]" with 4 shape options.
 * Difficulty controls how many shapes are in the pool.
 */
export function generateShapeQuestion(difficulty: Difficulty): ShapeQuestion {
  /* Harder difficulties use more shapes so distractors are harder */
  const poolSize = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : SHAPES.length;
  const pool = shuffle(SHAPES.slice(0, poolSize));

  const target = pool[0];
  const distractors = pool.slice(1, 4);

  const options = shuffle([
    { shape: target.name, color: target.color, label: target.labelKey },
    ...distractors.map((s) => ({
      shape: s.name,
      color: s.color,
      label: s.labelKey,
    })),
  ]);

  const correctIndex = options.findIndex((o) => o.shape === target.name);

  return {
    id: uid(),
    targetShape: target.name,
    targetLabel: target.labelKey,
    options,
    correctIndex,
  };
}

/* ------------------------------------------------------------------ */
/*  Memory card generation                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate a shuffled grid of memory cards (pairs of emojis).
 * @param pairCount Number of unique pairs (3+, capped to available emojis)
 */
export function generateMemoryCards(pairCount: number): MemoryCard[] {
  const clampedPairs = Math.min(Math.max(pairCount, 3), MEMORY_EMOJIS.length);
  const emojis = shuffle(MEMORY_EMOJIS).slice(0, clampedPairs);

  const cards: MemoryCard[] = [];
  for (const emoji of emojis) {
    const pairId = uid();
    cards.push({ id: uid(), pairId, emoji, flipped: false, matched: false });
    cards.push({ id: uid(), pairId, emoji, flipped: false, matched: false });
  }

  return shuffle(cards);
}
