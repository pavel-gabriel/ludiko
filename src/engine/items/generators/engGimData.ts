/**
 * Data accessors and morphology for the English (eng) gimnaziu generators, grades V-VIII.
 * Curated lists live in content/data/eng/gim-*.json (own work, provenance inside each file).
 * British spelling throughout (practise, colour, travelled).
 */
import verbsFile from '../../../../content/data/eng/gim-verbs.json';
import nounsFile from '../../../../content/data/eng/gim-nouns.json';
import adjFile from '../../../../content/data/eng/gim-adjectives.json';
import vocabFile from '../../../../content/data/eng/gim-vocab.json';
import sentencesFile from '../../../../content/data/eng/gim-sentences.json';
import wordformFile from '../../../../content/data/eng/gim-wordform.json';
import quizFile from '../../../../content/data/eng/gim-quiz.json';

export interface IrregularVerb { b: string; p: string; pp: string; ro: string; set: 'A' | 'B' }
export interface RegularVerb { b: string; ro: string }
export interface Noun { s: string; p: string; g: string; ro: string; art: 'a' | 'an' }
export interface Uncountable { s: string; ro: string }
export interface Adjective { b: string; c: string; s: string; g: string; ro: string; A: string; B: string; tail: string }
export interface VocabWord { en: string; ro: string }
export interface VocabTopic { id: string; grade: number; name: { ro: string; en: string }; words: VocabWord[] }
export interface OrderSentence { g: number; k: 's' | 'n' | 'q'; text: string }
export interface Phrase { v: string; rest: string }
export interface PassiveEntry { s: string; a: string; sp: boolean; v: string; o: string; pl: boolean; t: 'b' | 'p' }
export interface WordFormEntry { sentence: string; base: string; c: string; w: string[]; affix: string }
export interface QuizTopic { gaps: [string, string, string[]][]; qs: [string, string, string[]][] }

export const IRREGULAR = verbsFile.irregular as IrregularVerb[];
export const REGULAR = verbsFile.regular as RegularVerb[];
export const NOUNS = nounsFile.countable as Noun[];
export const UNCOUNTABLE = nounsFile.uncountable as Uncountable[];
export const ADJECTIVES = adjFile.adjectives as Adjective[];
export const VOCAB_TOPICS = vocabFile.topics as VocabTopic[];
export const ORDER_SENTENCES = sentencesFile.sentences as OrderSentence[];
export const PHRASES = sentencesFile.phrases as Phrase[];
export const PASSIVES = sentencesFile.passives as PassiveEntry[];
export const WORD_FORMS = wordformFile.entries as WordFormEntry[];
export const QUIZ_TOPICS = quizFile.topics as Record<string, QuizTopic>;

const irregularByBase = new Map(IRREGULAR.map((v) => [v.b, v]));
export const irregularVerb = (b: string): IrregularVerb | undefined => irregularByBase.get(b);

/* ------------------------------------------------------------------ */
/*  Morphology (rules + exceptions; tests recompute them independently) */
/* ------------------------------------------------------------------ */

/** Verbs whose final consonant doubles before -ing / -ed (stressed final syllable or one syllable CVC) */
const DOUBLING = new Set(['stop', 'plan', 'drop', 'shop', 'chat', 'run', 'swim', 'sit', 'get', 'put', 'cut', 'hit', 'begin', 'forget', 'shut']);
/** British spelling: final l doubles after one vowel */
const DOUBLE_L = new Set(['travel']);

const isVowel = (c: string) => 'aeiou'.includes(c);

export function thirdPerson(v: string): string {
  if (v === 'have') return 'has';
  if (/(s|x|z|ch|sh|o)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

export function ingForm(v: string): string {
  if (v.endsWith('ie')) return `${v.slice(0, -2)}ying`;
  if (v.endsWith('e') && !/(ee|ye|oe)$/.test(v)) return `${v.slice(0, -1)}ing`;
  if (DOUBLING.has(v)) return `${v}${v[v.length - 1]}ing`;
  if (DOUBLE_L.has(v)) return `${v}ling`;
  return `${v}ing`;
}

export function regularPast(v: string): string {
  if (v.endsWith('e')) return `${v}d`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ied`;
  if (DOUBLING.has(v)) return `${v}${v[v.length - 1]}ed`;
  if (DOUBLE_L.has(v)) return `${v}led`;
  return `${v}ed`;
}

export function pastSimple(v: string): string {
  const irr = irregularByBase.get(v);
  return irr ? irr.p : regularPast(v);
}

export function pastParticiple(v: string): string {
  const irr = irregularByBase.get(v);
  return irr ? irr.pp : regularPast(v);
}

/** The naive "base + ed" mistake children make (goed, buyed) — never equal to the correct form */
export function naivePast(v: string): string {
  const naive = isVowel(v[v.length - 1]) ? `${v}d` : `${v}ed`;
  return naive === pastSimple(v) ? `${v}ned` : naive;
}

/* ---- grammatical subjects ---------------------------------------- */

export interface Subject {
  /** As the first word of a sentence */
  text: string;
  /** In the middle of a question ("Does ___ play"): lower-case except I and names */
  mid: string;
  /** third person singular (takes -s / is / was / has) */
  third: boolean;
  /** first person singular ("I am / I was") */
  first: boolean;
}

export const SUBJECTS: readonly Subject[] = [
  { text: 'I', mid: 'I', third: false, first: true },
  { text: 'You', mid: 'you', third: false, first: false },
  { text: 'We', mid: 'we', third: false, first: false },
  { text: 'They', mid: 'they', third: false, first: false },
  { text: 'He', mid: 'he', third: true, first: false },
  { text: 'She', mid: 'she', third: true, first: false },
  { text: 'Tom', mid: 'Tom', third: true, first: false },
  { text: 'Maria', mid: 'Maria', third: true, first: false },
  { text: 'My brother', mid: 'my brother', third: true, first: false },
  { text: 'My parents', mid: 'my parents', third: false, first: false },
  { text: 'The children', mid: 'the children', third: false, first: false },
];

export const beForm = (s: Subject, past: boolean): string => (past ? (s.first || s.third ? 'was' : 'were') : s.first ? 'am' : s.third ? 'is' : 'are');
export const haveForm = (s: Subject): string => (s.third ? 'has' : 'have');
export const doForm = (s: Subject): string => (s.third ? 'does' : 'do');
export const presentForm = (s: Subject, v: string): string => (s.third ? thirdPerson(v) : v);

export const capitalise = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** A or an before an adjective (all adjectives in our list: vowel letter = vowel sound) */
export const articleForAdjective = (adj: string): 'a' | 'an' => (isVowel(adj[0]) ? 'an' : 'a');
