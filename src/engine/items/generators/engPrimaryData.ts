/**
 * Shared data + helpers for the English-as-a-foreign-language primary (`eng`, grades 0-IV) generators.
 * Curated lists live in content/data/eng/primary-*.json (own work, provenance inside each file).
 * British spelling throughout (Romanian schools mostly teach British English).
 *
 * Marker convention (documented in docs/ENGINE.md): English words/phrases taught inside a Romanian or
 * English prompt are written between «…». The item renderer offers a "listen" button for grades 0-II
 * that speaks exactly the text inside the markers with an English voice (src/ui/speech/englishSpeech.ts).
 */
import vocabFile from '../../../../content/data/eng/primary-vocab.json';
import listsFile from '../../../../content/data/eng/primary-lists.json';
import grammarFile from '../../../../content/data/eng/primary-grammar.json';
import readingFile from '../../../../content/data/eng/primary-reading.json';
import type { VisualSpec } from '../../types';
import { objectsSpec } from './visuals';

/* ---- vocabulary ----------------------------------------------------- */

export interface EngWord {
  en: string;
  ro: string;
  /** Picture emoji (every word has one, unique across the list) */
  e: string;
  topic: string;
  /** Semantic group for odd-one-out and sorting (animal, food, colour, ...) */
  group: string;
  /** Grade at which the word is taught */
  grade: number;
}

export const ENG_WORDS: readonly EngWord[] = vocabFile.words as unknown as EngWord[];

export const engVisual = (w: EngWord): VisualSpec => objectsSpec(w.e, 1);

/** Romanian / English names of the semantic groups (sort categories) */
export const GROUP_NAMES: Readonly<Record<string, { ro: string; en: string }>> = {
  animal: { ro: 'animale', en: 'animals' },
  food: { ro: 'mâncare și băuturi', en: 'food and drinks' },
  colour: { ro: 'culori', en: 'colours' },
  family: { ro: 'familie', en: 'family' },
  body: { ro: 'corpul', en: 'the body' },
  toy: { ro: 'jucării', en: 'toys' },
  school: { ro: 'lucruri de la școală', en: 'school things' },
  clothes: { ro: 'haine', en: 'clothes' },
  weather: { ro: 'vremea', en: 'weather' },
  season: { ro: 'anotimpuri', en: 'seasons' },
  house: { ro: 'lucruri din casă', en: 'things at home' },
  action: { ro: 'acțiuni', en: 'actions' },
  job: { ro: 'meserii', en: 'jobs' },
  place: { ro: 'locuri', en: 'places' },
};

/** Groups whose words can overlap in meaning (a school or a house is also a place, a teddy bear looks like a bear): never mixed in odd-one-out/sort */
const OVERLAPS: ReadonlyArray<readonly [string, string]> = [
  ['place', 'house'],
  ['place', 'school'],
  ['animal', 'toy'],
];
export const groupsClash = (a: string, b: string): boolean =>
  a === b || OVERLAPS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/* ---- greetings, days, months ---------------------------------------- */

export interface EngGreeting {
  intent: string;
  en: string;
  ro: string;
  grade: number;
  avoid?: string[];
  situation?: { ro: string; en: string };
}
export const ENG_GREETINGS: readonly EngGreeting[] = listsFile.greetings as unknown as EngGreeting[];

/** Two phrases that could both fit one situation are never offered together */
export const greetingsClash = (a: EngGreeting, b: EngGreeting): boolean =>
  a.intent === b.intent || !!a.avoid?.includes(b.intent) || !!b.avoid?.includes(a.intent);

export interface NamedItem {
  en: string;
  ro: string;
  season?: string;
}
export const ENG_DAYS: readonly NamedItem[] = listsFile.days;
export const ENG_MONTHS: readonly NamedItem[] = listsFile.months;

export const ORDINALS_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
export const ORDINALS_RO = ['prima', 'a doua', 'a treia', 'a patra', 'a cincea', 'a șasea', 'a șaptea', 'a opta', 'a noua', 'a zecea', 'a unsprezecea', 'a douăsprezecea'];

/* ---- grammar sentences ---------------------------------------------- */

export interface EngSentence {
  topic: string;
  grade: number;
  /** Full correct sentence */
  full: string;
  /** Sentence with {{gap}} where the answer goes */
  template: string;
  answer: string;
  wrong: string[];
  /** Romanian meaning (hint) */
  ro: string;
}

interface RawSentence {
  t: string;
  g: number;
  en: string;
  ro: string;
  x: string[];
}

export const ENG_SENTENCES: readonly EngSentence[] = (grammarFile.sentences as RawSentence[]).map((r) => {
  const m = /\[([^\]]+)\]/.exec(r.en) as RegExpExecArray;
  return {
    topic: r.t,
    grade: r.g,
    full: r.en.replace(/\[|\]/g, ''),
    template: r.en.replace(/\[[^\]]+\]/, '{{gap}}'),
    answer: m[1],
    wrong: r.x,
    ro: r.ro,
  };
});

export interface EngOpposite {
  a: string;
  b: string;
  ro: [string, string];
  g: number;
}
export const ENG_OPPOSITES: readonly EngOpposite[] = grammarFile.opposites as unknown as EngOpposite[];

/* ---- reading texts --------------------------------------------------- */

export type EngReadQuestion =
  | { ro: string; en: string; a: string; x: string[] }
  | { tf: boolean; s: string };

export interface EngReadText {
  id: string;
  g: number;
  title: string;
  text: string;
  q: EngReadQuestion[];
}
export const ENG_READING: readonly EngReadText[] = readingFile.texts as unknown as EngReadText[];

/* ---- numbers ---------------------------------------------------------- */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** English number word, 0-100 ("twenty-one", "one hundred") */
export function numberWord(n: number): string {
  if (n < 20) return ONES[n];
  if (n === 100) return 'one hundred';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
}

/* ---- telling the time (British) --------------------------------------- */

/** "four o'clock", "half past four", "a quarter to five", "ten past four", "twenty-five to five" (hour 1-12) */
export function timePhrase(hour: number, minutes: number): string {
  const h = ((hour - 1) % 12) + 1;
  const next = (h % 12) + 1;
  if (minutes === 0) return `${numberWord(h)} o'clock`;
  if (minutes === 30) return `half past ${numberWord(h)}`;
  if (minutes === 15) return `a quarter past ${numberWord(h)}`;
  if (minutes === 45) return `a quarter to ${numberWord(next)}`;
  if (minutes < 30) return `${numberWord(minutes)} past ${numberWord(h)}`;
  return `${numberWord(60 - minutes)} to ${numberWord(next)}`;
}

export const digitalTime = (hour: number, minutes: number): string => `${((hour - 1) % 12) + 1}:${String(minutes).padStart(2, '0')}`;
