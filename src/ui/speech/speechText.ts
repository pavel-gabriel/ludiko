/**
 * Text preparation for read-aloud: a small Romanian (and English) normaliser that makes voices read math and
 * symbols correctly, plus a sentence splitter so speech runs as a queue of short utterances
 * (smoother prosody, and avoids Chrome's ~15 s cut-off on long utterances).
 */

const RO_UNITS = ['zero', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă', 'zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece'];
const RO_TENS: Record<number, string> = { 20: 'douăzeci', 30: 'treizeci', 40: 'patruzeci', 50: 'cincizeci', 60: 'șaizeci', 70: 'șaptezeci', 80: 'optzeci', 90: 'nouăzeci' };

/** Romanian words for 0..99 (feminine: "o", "două"); larger numbers stay as digits (voices read those fine) */
export function roNumber(n: number, feminine = false): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (feminine && n === 1) return 'o';
  if (feminine && n === 2) return 'două';
  if (n < 20) return RO_UNITS[n];
  const tens = n - (n % 10);
  return n % 10 === 0 ? RO_TENS[tens] : `${RO_TENS[tens]} și ${RO_UNITS[n % 10]}`;
}

// denominator -> [singular, plural]
const RO_FRACTIONS: Record<number, [string, string]> = {
  2: ['doime', 'doimi'],
  3: ['treime', 'treimi'],
  4: ['pătrime', 'pătrimi'],
  5: ['cincime', 'cincimi'],
  6: ['șesime', 'șesimi'],
  7: ['șeptime', 'șeptimi'],
  8: ['optime', 'optimi'],
  9: ['noime', 'noimi'],
  10: ['zecime', 'zecimi'],
};

function roFraction(num: number, den: number): string {
  const names = RO_FRACTIONS[den];
  if (names && num >= 1 && num <= 99) return `${roNumber(num, true)} ${num === 1 ? names[0] : names[1]}`;
  return `${roNumber(num)} supra ${roNumber(den)}`;
}

function roDecimal(int: string, frac: string): string {
  const intWords = roNumber(Number(int));
  const fracWords =
    frac.length <= 2 && !frac.startsWith('0')
      ? roNumber(Number(frac))
      : frac
          .split('')
          .map((d) => RO_UNITS[Number(d)])
          .join(' ');
  return `${intWords} virgulă ${fracWords}`;
}

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍︎️⃣]/gu;
const BLANK = '[?_□▢▫◻]';
const OPS = '[+\\-−–×·*:=<>≤≥]';

/** Normalise text for a Romanian voice */
export function normaliseRo(input: string): string {
  let s = input.replace(EMOJI, ' ').replace(/[«»]/g, '');
  // blanks written as ? _ □ inside an expression ("3 + ? = 5", "? + 2 = 5")
  s = s.replace(new RegExp(`(${OPS}\\s*)${BLANK}`, 'gu'), '$1un număr');
  s = s.replace(new RegExp(`(^|[\\s(])${BLANK}(?=\\s*${OPS})`, 'gu'), '$1un număr');
  s = s.replace(/[□▢▫◻]/gu, 'un număr').replace(/_{2,}/g, ' un număr ');
  // fractions "3/4" (not part of dates / longer slash chains)
  s = s.replace(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (_m, a: string, b: string) =>
    Number(b) === 0 ? `${a} supra ${b}` : roFraction(Number(a), Number(b)),
  );
  // decimals "3,5"
  s = s.replace(/(?<![\d,.])(\d{1,2}),(\d{1,6})(?!\d)/g, (_m, i: string, f: string) => roDecimal(i, f));
  // operators
  s = s.replace(/\+/g, ' plus ');
  s = s.replace(/−/g, ' minus ');
  s = s.replace(/([\d)])\s+[-–]\s+(?=[\d(])/g, '$1 minus ');
  s = s.replace(/[×*]/g, ' ori ');
  s = s.replace(/([\d)])\s*·\s*(?=[\d(])/g, '$1 ori ');
  s = s.replace(/·/g, ', ');
  // division colon: spaced, or unspaced but not a clock time (10:30)
  s = s.replace(/([\d)])\s+:\s+(?=[\d(])/g, '$1 împărțit la ');
  s = s.replace(/(\d+):(\d+)/g, (m: string, a: string, b: string) =>
    Number(a) <= 23 && b.length === 2 && Number(b) <= 59 ? m : `${a} împărțit la ${b}`,
  );
  s = s.replace(/≠/g, ' diferit de ').replace(/≤/g, ' mai mic sau egal cu ').replace(/≥/g, ' mai mare sau egal cu ');
  s = s.replace(/</g, ' mai mic decât ').replace(/>/g, ' mai mare decât ');
  s = s.replace(/=/g, ' egal ');
  s = s.replace(/%/g, ' la sută ').replace(/²/g, ' la pătrat ').replace(/³/g, ' la cub ').replace(/√/g, ' radical din ');
  s = s.replace(/[→➜➔⇒⟶←⇐]/g, ', ');
  // decorative symbols voices would read literally
  s = s.replace(/[•▪■●○◆◇★☆✓✔✗✘✦▶►◀◄|~^#@\\[\]{}]/g, ' ');
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/,(\s*,)+/g, ',').trim();
}

/** Normalise text for an English voice (the same symbols, English words) */
export function normaliseEn(input: string): string {
  let s = input.replace(EMOJI, ' ').replace(/[«»]/g, '');
  s = s
    .replace(/\+/g, ' plus ')
    .replace(/−/g, ' minus ')
    .replace(/[×*]/g, ' times ')
    .replace(/(\d)\s*[·:÷]\s*(?=\d)/g, '$1 divided by ')
    .replace(/=/g, ' equals ')
    .replace(/[→➜➔⇒·]/g, ', ')
    .replace(/[•▪■●○◆◇★☆✓✔✗✘✦▶►◀◄|~^#@\\[\]{}□▢]/g, ' ');
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').trim();
}

export function normaliseForSpeech(text: string, lang: 'ro' | 'en'): string {
  return lang === 'ro' ? normaliseRo(text) : normaliseEn(text);
}

const MAX_CHUNK = 140;
const MIN_CHUNK = 24;

function wrapAt(parts: string[], sep: string, maxLen: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const part of parts) {
    const next = cur ? `${cur}${sep}${part}` : part;
    if (next.length > maxLen && cur) {
      out.push(cur);
      cur = part;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Split into sentences/clauses to speak as a queue. Sentences end at . ! ? … ; followed by a space (so "3.5" and
 * "3,5" survive); over-long sentences are broken at commas/colons, then at spaces. Tiny pieces merge with the next.
 */
export function splitSentences(text: string, maxLen = MAX_CHUNK): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const pieces: string[] = [];
  for (const sentence of t.split(/(?<=[.!?…;])\s+/).filter(Boolean)) {
    if (sentence.length <= maxLen) pieces.push(sentence);
    else pieces.push(...wrapAt(sentence.split(/(?<=[,:])\s+/), ' ', maxLen));
  }
  const wrapped = pieces.flatMap((p) => (p.length <= maxLen ? [p] : wrapAt(p.split(' '), ' ', maxLen)));
  const merged: string[] = [];
  let carry = '';
  for (const p of wrapped) {
    const joined = carry ? `${carry} ${p}` : p;
    if (joined.length < MIN_CHUNK) carry = joined;
    else {
      merged.push(joined);
      carry = '';
    }
  }
  if (carry) {
    if (merged.length) merged[merged.length - 1] += ` ${carry}`;
    else merged.push(carry);
  }
  return merged;
}

/** Normalise then split: the chunks to hand to the speech queue (only chunks with a letter or digit survive) */
export function prepareSpeech(text: string, lang: 'ro' | 'en'): string[] {
  return splitSentences(normaliseForSpeech(text, lang)).filter((c) => /[\p{L}\d]/u.test(c));
}
