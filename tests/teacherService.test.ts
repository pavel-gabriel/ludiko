import { describe, it, expect } from 'vitest';
import {
  generateStudentCodes,
  exportResultsToCSV,
} from '@/services/teacherService';
import type { StudentSessionResult } from '@/utils/types';

describe('generateStudentCodes', () => {
  it('generates the correct number of codes', () => {
    const codes = generateStudentCodes(10);
    expect(codes).toHaveLength(10);
  });

  it('generates unique codes', () => {
    const codes = generateStudentCodes(20);
    const codeStrings = codes.map((c) => c.code);
    expect(new Set(codeStrings).size).toBe(20);
  });

  it('codes follow ANIMAL-NN format', () => {
    const codes = generateStudentCodes(5);
    for (const { code } of codes) {
      expect(code).toMatch(/^[A-Z]{3,4}-\d{2}$/);
    }
  });

  it('assigns sequential labels', () => {
    const codes = generateStudentCodes(3);
    expect(codes[0].label).toBe('Student 1');
    expect(codes[1].label).toBe('Student 2');
    expect(codes[2].label).toBe('Student 3');
  });
});

describe('exportResultsToCSV', () => {
  it('generates valid CSV with header and rows', () => {
    const results: StudentSessionResult[] = [
      {
        studentCode: 'LION-42',
        studentLabel: 'Student 1',
        score: 8,
        totalQuestions: 10,
        accuracy: 80,
        timeTaken: 120,
        answers: [],
      },
      {
        studentCode: 'BEAR-15',
        studentLabel: 'Student 2',
        score: 6,
        totalQuestions: 10,
        accuracy: 60,
        timeTaken: 150,
        answers: [],
      },
    ];

    const csv = exportResultsToCSV('Test Session', results);
    const lines = csv.split('\n');

    // Comment lines
    expect(lines[0]).toContain('# Test Session');
    expect(lines[1]).toContain('# Exported');

    // Header
    expect(lines[3]).toBe('Student Code,Label,Score,Total Questions,Accuracy (%),Time (s)');

    // Data rows
    expect(lines[4]).toBe('LION-42,Student 1,8,10,80,120');
    expect(lines[5]).toBe('BEAR-15,Student 2,6,10,60,150');
  });

  it('handles empty results', () => {
    const csv = exportResultsToCSV('Empty', []);
    expect(csv).toContain('# Empty');
    expect(csv).toContain('Student Code,Label');
  });
});
