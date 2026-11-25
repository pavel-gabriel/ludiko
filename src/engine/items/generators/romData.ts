/**
 * Shared data + helpers for the Romanian (`rom`) generators.
 * The curated lists live in content/data/rom/*.json (own work, provenance inside each file).
 */
import wordsFile from '../../../../content/data/rom/words.json';
import sentencesFile from '../../../../content/data/rom/sentences.json';
import vocabFile from '../../../../content/data/rom/vocab.json';
import type { CardContent, VisualSpec } from '../../types';
import { objectsSpec } from './visuals';

/* ---- word list ----------------------------------------------------- */

export interface RomWord {
  /** The word, e.g. "casă" */
  w: string;
  /** Standard hyphenation, e.g. "ca-să" */
  s: string;
  /** Picture emoji (absent for words that cannot be drawn unambiguously) */
  e?: string;
  /** English gloss */
  en: string;
  /** Meaning group: a picture of the word may also be a valid picture of any other word with the same tag (bird, tree, ...) */
  g?: string;
  /** Syllables */
  syl: string[];
}

interface RawWord {
  w: string;
  s: string;
  e?: string;
  en: string;
  g?: string;
}

export const ROM_WORDS: readonly RomWord[] = (wordsFile.words as unknown as RawWord[]).map((r) => ({
  ...r,
  syl: r.s.split('-'),
}));

/** Words that have an unambiguous picture */
export const PICTURE_WORDS: readonly RomWord[] = ROM_WORDS.filter((w) => w.e);

export const wordVisual = (w: RomWord): VisualSpec => objectsSpec(w.e as string, 1);

export const wordCard = (w: RomWord, withText = true): CardContent => ({
  id: `w_${w.w}`,
  ...(withText ? { text: { ro: w.w } } : {}),
  ...(w.e ? { visual: wordVisual(w) } : {}),
});

/* ---- sentences ----------------------------------------------------- */

export const ORDER_SENTENCES: readonly string[] = sentencesFile.order;
export const STATEMENTS: readonly string[] = sentencesFile.statements;
export const QUESTIONS: readonly string[] = sentencesFile.questions;
export const EXCLAMATIONS: readonly string[] = sentencesFile.exclamations;

/* ---- vocabulary ---------------------------------------------------- */

export type WordPair = readonly [string, string];
export const ANTONYMS = vocabFile.antonyms as unknown as WordPair[];
export const SYNONYMS = vocabFile.synonyms as unknown as WordPair[];

/* ---- letters ------------------------------------------------------- */

export const VOWELS: readonly string[] = ['a', 'ă', 'â', 'e', 'i', 'î', 'o', 'u'];
/** Consonants of the Romanian alphabet (common ones first, rare foreign letters last) */
export const CONSONANTS_COMMON: readonly string[] = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'l', 'm', 'n', 'p', 'r', 's', 'ș', 't', 'ț', 'v', 'z',
];
export const CONSONANTS_RARE: readonly string[] = ['k', 'x', 'q', 'w', 'y'];

export const isVowel = (ch: string): boolean => VOWELS.includes(ch.toLowerCase());
