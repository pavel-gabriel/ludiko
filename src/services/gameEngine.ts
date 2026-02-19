import type { Difficulty, Operation, Question } from '@/utils/types';
import { DIFFICULTY_RANGES } from '@/utils/constants';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

export function generateQuestion(
  difficulty: Difficulty,
  operations: Operation[],
): Question {
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const { a, b } = generateOperands(difficulty, operation);
  const correctAnswer = computeAnswer(a, b, operation);

  const wrongAnswers = generateWrongAnswers(correctAnswer, 3);
  const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

  return {
    id: Math.random().toString(36).substring(2, 8),
    a,
    b,
    operation,
    correctAnswer,
    options,
  };
}

export function checkAnswer(question: Question, answer: number): boolean {
  return answer === question.correctAnswer;
}
