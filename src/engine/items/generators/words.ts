/** Number words 0-100 (Romanian and English) for number-recognition items. */

const RO_UNITS = ['zero', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const RO_TEENS = [
  'zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece',
  'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece',
];
const RO_TENS = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];

export function roWord(n: number): string {
  if (n < 0 || n > 100 || !Number.isInteger(n)) throw new RangeError(`roWord: ${n} out of range`);
  if (n < 10) return RO_UNITS[n];
  if (n < 20) return RO_TEENS[n - 10];
  if (n === 100) return 'o sută';
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? RO_TENS[t] : `${RO_TENS[t]} și ${RO_UNITS[u]}`;
}

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = [
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function enWord(n: number): string {
  if (n < 0 || n > 100 || !Number.isInteger(n)) throw new RangeError(`enWord: ${n} out of range`);
  if (n < 10) return EN_UNITS[n];
  if (n < 20) return EN_TEENS[n - 10];
  if (n === 100) return 'one hundred';
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? EN_TENS[t] : `${EN_TENS[t]}-${EN_UNITS[u]}`;
}
