/** Kid-friendly countable things with Romanian/English plurals (shared by counting and word problems). */
export interface Thing {
  icon: string;
  /** Romanian plural, e.g. "mere" */
  ro: string;
  /** English plural, e.g. "apples" */
  en: string;
  food: boolean;
}

export const THINGS: readonly Thing[] = [
  { icon: '🍎', ro: 'mere', en: 'apples', food: true },
  { icon: '🍐', ro: 'pere', en: 'pears', food: true },
  { icon: '🍌', ro: 'banane', en: 'bananas', food: true },
  { icon: '🍪', ro: 'biscuiți', en: 'cookies', food: true },
  { icon: '🍬', ro: 'bomboane', en: 'candies', food: true },
  { icon: '🎈', ro: 'baloane', en: 'balloons', food: false },
  { icon: '✏️', ro: 'creioane', en: 'pencils', food: false },
  { icon: '⚽', ro: 'mingi', en: 'balls', food: false },
  { icon: '📚', ro: 'cărți', en: 'books', food: false },
  { icon: '🌸', ro: 'flori', en: 'flowers', food: false },
  { icon: '⭐', ro: 'stele', en: 'stars', food: false },
  { icon: '🚗', ro: 'mașinuțe', en: 'toy cars', food: false },
  { icon: '🦋', ro: 'fluturi', en: 'butterflies', food: false },
  { icon: '🐟', ro: 'pești', en: 'fish', food: false },
  { icon: '🐞', ro: 'buburuze', en: 'ladybugs', food: false },
];

/** Romanian count phrase for n >= 2: from 20 up the noun takes "de" ("20 de mere", "7 mere"). */
export const roCount = (n: number, t: Thing): string => (n % 100 === 0 || n % 100 >= 20 ? `${n} de ${t.ro}` : `${n} ${t.ro}`);
