/**
 * Data accessors for the geography gimnaziu (grades V-VIII) generators.
 * The curated lists live in content/data/geo/{countries,romania,world,quiz-gimnaziu}.json
 * (own work, provenance inside each file).
 */
import countriesFile from '../../../../content/data/geo/countries.json';
import romaniaFile from '../../../../content/data/geo/romania.json';
import worldFile from '../../../../content/data/geo/world.json';
import quizFile from '../../../../content/data/geo/quiz-gimnaziu.json';

export type ContinentId = 'europa' | 'asia' | 'africa' | 'america-nord' | 'america-sud' | 'oceania';

export interface Country {
  id: string;
  ro: string;
  en: string;
  capital: { ro: string; en: string };
  continent: ContinentId;
  eu: boolean;
  landlocked?: boolean;
  core?: boolean;
  borderRomania?: boolean;
}

export const COUNTRIES = countriesFile.countries as Country[];
export const CONTINENT_NAMES = countriesFile.continents as Record<ContinentId, { ro: string; en: string }>;
export const EUROPE = COUNTRIES.filter((c) => c.continent === 'europa');

export type CapitalScope = 'europe-core' | 'europe' | 'neighbours' | 'asia' | 'africa' | 'america-nord' | 'america-sud' | 'oceania' | 'world';

/** Country pools for the capital generator and sorting items */
export function countriesFor(scope: CapitalScope): Country[] {
  switch (scope) {
    case 'europe-core':
      return EUROPE.filter((c) => c.core);
    case 'europe':
      return EUROPE;
    case 'neighbours':
      return EUROPE.filter((c) => c.borderRomania);
    case 'world':
      return COUNTRIES.filter((c) => c.continent !== 'europa');
    default:
      return COUNTRIES.filter((c) => c.continent === scope);
  }
}

/* ---- Romania ------------------------------------------------------- */

export interface County { id: string; ro: string; seat: string | null; region: string | null }
export interface RoRiver { id: string; ro: string; lengthKm: number; mouth: string }
export interface Peak { ro: string; massif: string; group: string; heightM: number }
export interface ReliefUnit { ro: string; form: string; note: string }

export const COUNTIES = romaniaFile.counties as County[];
export const RO_RIVERS = romaniaFile.rivers as RoRiver[];
export const CITY_RIVERS = romaniaFile.cityRivers as { city: string; river: string }[];
export const PEAKS = romaniaFile.peaks as Peak[];
export const MASSIFS = romaniaFile.massifs as { ro: string; group: string }[];
export const RELIEF_UNITS = romaniaFile.reliefUnits as ReliefUnit[];
export const RELIEF_FORMS = romaniaFile.reliefForms as string[];
export const RELIEF_FEATURES = romaniaFile.features as { ro: string; form: string }[];
export const RO_CAPITAL = romaniaFile.capital;

/* ---- world --------------------------------------------------------- */

export interface Named { ro: string; en: string }
export interface Valued extends Named { v: number }
export interface WorldPeak extends Valued { continent: string; continentEn: string }
export interface WorldMountain extends Named { continent: ContinentId }
export interface WorldRiver extends Named { continent: ContinentId; mouth: Named }

export const PLANETS_FROM_SUN = worldFile.planetsFromSun as Named[];
export const PLANETS_BY_SIZE = worldFile.planetsBySize as Valued[];
export const CONTINENTS_BY_AREA = worldFile.continentsByArea as Valued[];
export const OCEANS_BY_AREA = worldFile.oceansByArea as Valued[];
export const WORLD_PEAKS = worldFile.worldPeaks as WorldPeak[];
export const WORLD_MOUNTAINS = worldFile.mountains as WorldMountain[];
export const WORLD_RIVERS = worldFile.rivers as WorldRiver[];

/* ---- quiz ---------------------------------------------------------- */

export interface QuizEntry { prompt: string; correct: string; wrong: string[] }
export interface TfEntry { statement: string; correct: boolean }

const topics = quizFile.topics as unknown as Record<string, { mcq: string[][]; tf: [string, boolean][] }>;

export const QUIZ_TOPICS: Record<string, { mcq: QuizEntry[]; tf: TfEntry[] }> = Object.fromEntries(
  Object.entries(topics).map(([k, v]) => [
    k,
    {
      mcq: v.mcq.map(([prompt, correct, ...wrong]) => ({ prompt, correct, wrong })),
      tf: v.tf.map(([statement, correct]) => ({ statement, correct })),
    },
  ]),
);
