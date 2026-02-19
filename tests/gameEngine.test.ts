import { describe, it, expect } from 'vitest';
import { generateQuestion, checkAnswer } from '../src/services/gameEngine';
import type { Difficulty, Operation } from '../src/utils/types';

describe('gameEngine', () => {
  describe('generateQuestion', () => {
    it('generates a question with 4 options', () => {
      const q = generateQuestion('easy', ['+']);
      expect(q.options).toHaveLength(4);
    });

    it('includes the correct answer in options', () => {
      const q = generateQuestion('easy', ['+']);
      expect(q.options).toContain(q.correctAnswer);
    });

    it('generates correct addition results', () => {
      const q = generateQuestion('easy', ['+']);
      expect(q.correctAnswer).toBe(q.a + q.b);
    });

    it('generates correct subtraction results (a >= b)', () => {
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion('easy', ['-']);
        expect(q.correctAnswer).toBe(q.a - q.b);
        expect(q.a).toBeGreaterThanOrEqual(q.b);
      }
    });

    it('generates correct multiplication results', () => {
      const q = generateQuestion('easy', ['×']);
      expect(q.correctAnswer).toBe(q.a * q.b);
    });

    it('generates correct division results (no remainder)', () => {
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion('easy', ['÷']);
        expect(q.correctAnswer).toBe(q.a / q.b);
        expect(q.a % q.b).toBe(0);
      }
    });

    it('respects difficulty ranges', () => {
      const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
      for (const d of difficulties) {
        for (let i = 0; i < 10; i++) {
          const q = generateQuestion(d, ['+']);
          expect(q.a).toBeGreaterThanOrEqual(1);
          expect(q.b).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('picks from allowed operations only', () => {
      const ops: Operation[] = ['+', '-'];
      for (let i = 0; i < 20; i++) {
        const q = generateQuestion('easy', ops);
        expect(ops).toContain(q.operation);
      }
    });
  });

  describe('checkAnswer', () => {
    it('returns true for correct answer', () => {
      const q = generateQuestion('easy', ['+']);
      expect(checkAnswer(q, q.correctAnswer)).toBe(true);
    });

    it('returns false for wrong answer', () => {
      const q = generateQuestion('easy', ['+']);
      expect(checkAnswer(q, q.correctAnswer + 999)).toBe(false);
    });
  });
});
