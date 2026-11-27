/**
 * Data accessors for the Romanian gimnaziu (grades V-VIII) generators.
 * The curated lists live in content/data/rom/*.json (own work, provenance inside each file).
 */
import spellingFile from '../../../../content/data/rom/spelling.json';
import grammarFile from '../../../../content/data/rom/grammar.json';
import vocabFile from '../../../../content/data/rom/vocab-gimnaziu.json';
import quizFile from '../../../../content/data/rom/quiz-gimnaziu.json';

/* ---- spelling ------------------------------------------------------ */

export interface SpellingEntry {
  /** Group key (sa, sau, ia, ...) */
  g: string;
  /** Sentence with one {{gap}} */
  t: string;
  /** The correct form */
  a: string;
}

export const SPELLING_GROUPS = spellingFile.groups as Record<string, string[]>;
export const SPELLING: readonly SpellingEntry[] = (spellingFile.items as [string, string, string][]).map(([g, t, a]) => ({ g, t, a }));

/* ---- parts of speech ---------------------------------------------- */

export interface PosEntry {
  s: string;
  w: string;
  label: string;
}
export const POS_LABELS: readonly string[] = grammarFile.pos.labels;
export const POS_ITEMS: readonly PosEntry[] = (grammarFile.pos.items as [string, string, string][]).map(([s, w, label]) => ({ s, w, label }));

/* ---- verbs --------------------------------------------------------- */

export type VerbKind = 'tense' | 'mood' | 'person';
export interface VerbEntry {
  kind: VerbKind;
  s: string;
  w: string;
  label: string;
}
export const VERB_LABELS: Record<VerbKind, readonly string[]> = {
  tense: grammarFile.verbs.tenses,
  mood: grammarFile.verbs.moods,
  person: grammarFile.verbs.persons,
};
export const VERB_ITEMS: readonly VerbEntry[] = (grammarFile.verbs.items as [string, string, string, string][]).map(
  ([kind, s, w, label]) => ({ kind: kind as VerbKind, s, w, label }),
);

/* ---- syntax -------------------------------------------------------- */

export interface RoleEntry {
  s: string;
  w: string;
  label: string;
}
export const ROLE_LABELS: readonly string[] = grammarFile.syntax.roles;
export const ROLE_ITEMS: readonly RoleEntry[] = (grammarFile.syntax.items as [string, string, string][]).map(([s, w, label]) => ({ s, w, label }));

export interface FrazaEntry {
  s: string;
  relation: 'coordonare' | 'subordonare';
  clauses: number;
}
export const FRAZA_ITEMS: readonly FrazaEntry[] = (grammarFile.syntax.fraza as [string, string, number][]).map(([s, relation, clauses]) => ({
  s,
  relation: relation as FrazaEntry['relation'],
  clauses,
}));

export interface SubordEntry {
  s: string;
  clause: string;
  label: string;
}
export const SUBORD_LABELS: readonly string[] = grammarFile.syntax.subordinateLabels;
export const SUBORD_ITEMS: readonly SubordEntry[] = (grammarFile.syntax.subordinate as [string, string, string][]).map(
  ([s, clause, label]) => ({ s, clause, label }),
);

/* ---- figures of speech -------------------------------------------- */

export interface FigureEntry {
  figure: string;
  line: string;
}
export const FIGURE_LABELS: readonly string[] = grammarFile.figures.labels;
export const FIGURE_ITEMS: readonly FigureEntry[] = (grammarFile.figures.items as [string, string][]).map(([figure, line]) => ({ figure, line }));

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

/* ---- curated multiple-choice quiz ---------------------------------- */

export interface QuizEntry {
  prompt: string;
  correct: string;
  wrong: string[];
}
export const QUIZ: Record<string, readonly QuizEntry[]> = Object.fromEntries(
  Object.entries(quizFile.topics as Record<string, string[][]>).map(([topic, rows]) => [
    topic,
    rows.map(([prompt, correct, ...wrong]) => ({ prompt, correct, wrong })),
  ]),
);

/** Uppercase the first letter (Romanian locale) — used when a gap opens a sentence */
export const capitalize = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase('ro') + s.slice(1) : s);
