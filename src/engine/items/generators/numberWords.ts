/**
 * Number words 0 - 1 000 000 in Romanian and English (for number-reading items).
 *
 * Romanian rules implemented (DOOM3 forms):
 *  - units agree with the noun: masculine/neuter "unu, doi, doisprezece, douăzeci și doi";
 *    before "sute" and "mii" (feminine) "două, douăsprezece, douăzeci și două, ... și una".
 *  - 100 "o sută", 200 "două sute"; 1 000 "o mie", 2 000 "două mii"; 1 000 000 "un milion".
 *  - "de" links a count of 20-99 (or a full hundred) to "mii": "douăzeci de mii", "o sută de mii",
 *    but "cincisprezece mii", "o sută două mii".
 */

const RO_M = ['zero', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const RO_F = ['zero', 'una', 'două', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const RO_TEEN_M = [
  'zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece',
  'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece',
];
const RO_TEEN_F = [...RO_TEEN_M];
RO_TEEN_F[2] = 'douăsprezece';
const RO_TENS = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];

function roBelow100(n: number, fem: boolean): string {
  const units = fem ? RO_F : RO_M;
  if (n < 10) return units[n];
  if (n < 20) return (fem ? RO_TEEN_F : RO_TEEN_M)[n - 10];
  const u = n % 10;
  return u === 0 ? RO_TENS[Math.floor(n / 10)] : `${RO_TENS[Math.floor(n / 10)]} și ${units[u]}`;
}

function roBelow1000(n: number, fem: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? 'o sută' : `${RO_F[h]} sute`);
  if (r) parts.push(roBelow100(r, fem));
  return parts.join(' ');
}

/** Romanian words for 0 <= n <= 1 000 000 */
export function roNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new RangeError(`roNumber: ${n} out of range`);
  if (n === 0) return 'zero';
  if (n === 1_000_000) return 'un milion';
  const t = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (t === 1) parts.push('o mie');
  else if (t > 1) parts.push(`${roBelow1000(t, true)}${t % 100 === 0 || t % 100 >= 20 ? ' de' : ''} mii`);
  if (rest) parts.push(roBelow1000(rest, false));
  return parts.join(' ');
}

const EN_UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelow1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${EN_UNITS[h]} hundred`);
  if (r) parts.push(r < 20 ? EN_UNITS[r] : r % 10 ? `${EN_TENS[Math.floor(r / 10)]}-${EN_UNITS[r % 10]}` : EN_TENS[r / 10]);
  return parts.join(' ');
}

/** English words for 0 <= n <= 1 000 000 */
export function enNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new RangeError(`enNumber: ${n} out of range`);
  if (n === 0) return 'zero';
  if (n === 1_000_000) return 'one million';
  const t = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (t) parts.push(`${enBelow1000(t)} thousand`);
  if (rest) parts.push(enBelow1000(rest));
  return parts.join(' ');
}
