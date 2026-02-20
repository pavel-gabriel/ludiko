import type { Difficulty, Operation, Question, ShapeQuestion, MemoryCard } from '@/utils/types';
import { DIFFICULTY_RANGES, SHAPES, MEMORY_EMOJIS } from '@/utils/constants';

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
      return a / b;
  }
}

function generateOperands(
  difficulty: Difficulty,
  operation: Operation,
): { a: number; b: number } {
  const { min, max } = DIFFICULTY_RANGES[difficulty];

  if (operation === '÷') {
    const b = randomInt(Math.max(min, 1), Math.min(max, 12));
    const quotient = randomInt(min, max);
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
    const wrong = correct + (Math.random() > 0.5 ? offset : -offset);
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
