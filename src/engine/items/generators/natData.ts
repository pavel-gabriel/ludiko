/**
 * Data accessors for the gimnaziu natural-science generators (bio V-VIII, fiz VI-VIII, chim VII-VIII).
 * The curated question tables live in content/data/nat/{bio,fiz,chim}.json (own work, provenance inside each file).
 */
import bioFile from '../../../../content/data/nat/bio.json';
import fizFile from '../../../../content/data/nat/fiz.json';
import chimFile from '../../../../content/data/nat/chim.json';

/** [prompt, correct answer, ...wrong answers] */
export type NatQ = string[];
/** [statement, true?] */
export type NatTf = [string, boolean];
/** [left, right] */
export type NatPair = [string, string];
/** [prompt, labelA, labelB, itemsA, itemsB] */
export type NatSort = [string, string, string, string[], string[]];
/** [prompt, ...steps in the correct order] */
export type NatOrder = string[];

export interface NatTopic {
  q?: NatQ[];
  tf?: NatTf[];
  /** groups of 3+ pairs; an item draws 3-4 pairs of one group */
  m?: NatPair[][];
  s?: NatSort[];
  o?: NatOrder[];
}

/** topic id (= skill id) -> curated entries */
export const NAT_TOPICS: Record<string, NatTopic> = {
  ...(bioFile.topics as unknown as Record<string, NatTopic>),
  ...(fizFile.topics as unknown as Record<string, NatTopic>),
  ...(chimFile.topics as unknown as Record<string, NatTopic>),
};
