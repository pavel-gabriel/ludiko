/**
 * Shared data for the history (`ist`) generators: the curated event table, rulers, true/false facts
 * and legend-or-fact statements live in content/data/ist/history.json (own work, provenance inside).
 */
import historyFile from '../../../../content/data/ist/history.json';

export interface IstEvent {
  id: string;
  /** Negative = before Christ (no year 0) */
  year: number;
  approx: boolean;
  topic: string;
  ro: string;
  en: string;
  /** Sentence start that ends right before the year, e.g. "Unirea Principatelor a avut loc în anul" */
  stemRo: string;
  stemEn: string;
}

export interface IstRuler {
  id: string;
  era: 'ancient' | 'medieval' | 'modern';
  topics: string[];
  ro: string;
  en: string;
  achRo: string;
  achEn: string;
  /** [first year, last year] when the reign is known exactly */
  reign?: [number, number];
}

export interface IstFact {
  topic: string;
  ok: boolean;
  ro: string;
  en: string;
}

export interface IstLegend {
  topic: string;
  /** L = legend or made-up story, F = historical fact */
  kind: 'L' | 'F';
  ro: string;
  en: string;
}

export const IST_EVENTS = historyFile.events as readonly IstEvent[];
export const IST_RULERS = historyFile.rulers as readonly IstRuler[];
export const IST_FACTS = historyFile.facts as readonly IstFact[];
export const IST_LEGENDS = historyFile.legends as readonly IstLegend[];
