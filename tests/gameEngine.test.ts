import { describe, it, expect } from 'vitest';
import { generateQuestion, checkAnswer, generateShapeQuestion, generateMemoryCards } from '../src/services/gameEngine';
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

    it('division always returns integer answers', () => {
      for (let i = 0; i < 50; i++) {
        const q = generateQuestion('hard', ['÷']);
        expect(Number.isInteger(q.correctAnswer)).toBe(true);
        expect(q.options.every((o) => Number.isInteger(o))).toBe(true);
      }
    });

    it('all options are non-negative integers', () => {
      const ops: Operation[] = ['+', '-', '×', '÷'];
      for (let i = 0; i < 50; i++) {
        const q = generateQuestion('medium', ops);
        expect(Number.isInteger(q.correctAnswer)).toBe(true);
        for (const opt of q.options) {
          expect(opt).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(opt)).toBe(true);
        }
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

    it('generates unique options (no duplicates)', () => {
      for (let i = 0; i < 30; i++) {
        const q = generateQuestion('easy', ['+']);
        const unique = new Set(q.options);
        expect(unique.size).toBe(q.options.length);
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

  describe('generateShapeQuestion', () => {
    it('generates a question with 4 options', () => {
      const q = generateShapeQuestion('easy');
      expect(q.options).toHaveLength(4);
    });

    it('correctIndex points to the target shape', () => {
      for (let i = 0; i < 20; i++) {
        const q = generateShapeQuestion('medium');
        expect(q.options[q.correctIndex].shape).toBe(q.targetShape);
      }
    });

    it('has unique shapes in options', () => {
      const q = generateShapeQuestion('hard');
      const shapes = q.options.map((o) => o.shape);
      expect(new Set(shapes).size).toBe(4);
    });

    it('has a valid id and label', () => {
      const q = generateShapeQuestion('easy');
      expect(q.id).toBeTruthy();
      expect(q.targetLabel).toBeTruthy();
    });
  });

  describe('generateMemoryCards', () => {
    it('generates the correct number of cards (2 per pair)', () => {
      const cards = generateMemoryCards(6);
      expect(cards).toHaveLength(12);
    });

    it('clamps to minimum 3 pairs', () => {
      const cards = generateMemoryCards(1);
      expect(cards).toHaveLength(6);
    });

    it('every card has a matching pair', () => {
      const cards = generateMemoryCards(8);
      const pairCounts: Record<string, number> = {};
      for (const card of cards) {
        pairCounts[card.pairId] = (pairCounts[card.pairId] ?? 0) + 1;
      }
      for (const count of Object.values(pairCounts)) {
        expect(count).toBe(2);
      }
    });

    it('paired cards share the same emoji', () => {
      const cards = generateMemoryCards(8);
      const pairEmojis: Record<string, string> = {};
      for (const card of cards) {
        if (pairEmojis[card.pairId]) {
          expect(card.emoji).toBe(pairEmojis[card.pairId]);
        } else {
          pairEmojis[card.pairId] = card.emoji;
        }
      }
    });

    it('cards start unflipped and unmatched', () => {
      const cards = generateMemoryCards(5);
      for (const card of cards) {
        expect(card.flipped).toBe(false);
        expect(card.matched).toBe(false);
      }
    });

    it('each card has a unique id', () => {
      const cards = generateMemoryCards(10);
      const ids = cards.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
