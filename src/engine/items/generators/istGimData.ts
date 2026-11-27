/**
 * Data for the history gimnaziu (V-VIII) generators: the curated events dataset and the facts / term pairs /
 * questions / sorting sets live in content/data/ist/*-gimnaziu.json (own work, provenance inside).
 */
import eventsFile from '../../../../content/data/ist/events-gimnaziu.json';
import factsFile from '../../../../content/data/ist/facts-gimnaziu.json';

export interface GimEvent {
  id: string;
  /** Negative = before Christ (there is no year 0) */
  year: number;
  /** Date is approximate or traditional */
  approx: boolean;
  grade: 5 | 6 | 7 | 8;
  /** Topic tags; a skill lists the tags it draws from */
  tags: string[];
  ro: string;
  en: string;
}

export interface GimText {
  ro: string;
  en: string;
}
export interface GimFact extends GimText {
  tag: string;
  ok: boolean;
}
export interface GimPair {
  tag: string;
  left: GimText;
  right: GimText;
}
export interface GimChoice extends GimText {
  tag: string;
  options: GimText[];
  /** index of the correct option */
  correct: number;
}
export interface GimSort {
  id: string;
  tag: string;
  promptRo: string;
  promptEn: string;
  categories: { id: string; ro: string; en: string }[];
  cards: { cat: string; ro: string; en: string }[];
}

export const GIM_EVENTS = eventsFile.events as readonly GimEvent[];
export const GIM_FACTS = factsFile.facts as readonly GimFact[];
export const GIM_PAIRS = factsFile.pairs as readonly GimPair[];
export const GIM_CHOICES = factsFile.choices as readonly GimChoice[];
export const GIM_SORTS = factsFile.sorts as readonly GimSort[];

/** Events older than this are only used for ordering ("which first"), never for years or centuries */
export const DEEP_YEAR = -3000;
