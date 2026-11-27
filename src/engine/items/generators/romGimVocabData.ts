/**
 * Romanian gimnaziu vocabulary data (synonyms, antonyms, paronyms, homonyms) from
 * content/data/rom/vocab-gimnaziu.json (own work, provenance inside). Split from ./romGimnaziuData so the
 * word-relations generator (also used by grades 0–IV) does not pull the other gimnaziu lists.
 */
import vocabFile from '../../../../content/data/rom/vocab-gimnaziu.json';

/* ---- vocabulary ---------------------------------------------------- */

export type WordPair = readonly [string, string];
export const GIM_SYNONYMS = vocabFile.synonyms as unknown as WordPair[];
export const GIM_ANTONYMS = vocabFile.antonyms as unknown as WordPair[];

export interface ParonymEntry {
  /** Sentence with one {{gap}} */
  t: string;
  correct: string;
  wrong: string;
}
export const PARONYMS: readonly ParonymEntry[] = (vocabFile.paronyms as [string, string, string][]).map(([t, correct, wrong]) => ({ t, correct, wrong }));

export interface HomonymEntry {
  w: string;
  /** Each sense lists at least two example sentences */
  senses: string[][];
}
export const HOMONYMS: readonly HomonymEntry[] = vocabFile.homonyms as HomonymEntry[];

/** Uppercase the first letter (Romanian locale) — used when a gap opens a sentence */
export const capitalize = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase('ro') + s.slice(1) : s);
