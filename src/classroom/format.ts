/** "vin., 28 nov." for a YYYY-MM-DD day (local), in the UI language; the raw string if it is not a date */
export function formatDay(day: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return day
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return date.toLocaleDateString(lang.startsWith('en') ? 'en-GB' : 'ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
}
