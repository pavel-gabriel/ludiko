import { describe, it, expect } from 'vitest';
import { generateItems } from '../src/engine/items/generators';
import { getAllSkills } from '../src/engine/content/registry';

describe('vowel-count questions are unambiguous', () => {
  it('never asks about words with adjacent vowels or a final short i', () => {
    const skills = getAllSkills().filter((s) => s.itemSources.some((src) => 'generator' in src && src.generator === 'letters'));
    expect(skills.length).toBeGreaterThan(0);
    let seen = 0;
    for (const skill of skills) {
      for (const item of generateItems(skill, 300, { seed: 11 })) {
        const m = item.prompt.ro.match(/Câte litere-vocale are cuvântul „(.+?)”/);
        if (!m) continue;
        seen++;
        expect(/[aeiouăâî]{2}/.test(m[1]), m[1]).toBe(false);
        expect(/[^aeiouăâî]i$/.test(m[1]), m[1]).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
