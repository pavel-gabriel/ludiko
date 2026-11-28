// Pure logic for the daily push reminders (docs/NOTIFICATIONS.md §4). No I/O: safe to unit-test.

export const DEFAULT_TIMEZONE = 'Europe/Bucharest';
export const MIN_HOUR = 8;
export const MAX_HOUR = 20;
export const REMINDER_URL = '/learn';
export const REMINDER_TAG = 'ludiko-daily';

const TITLE = { ro: 'Ludiko', en: 'Ludiko' };

// Original, gentle messages. No guilt or loss language (no streaks, no "you'll lose").
const MESSAGES = {
  ro: [
    'Bitul de azi te așteaptă: 3 minute de joacă! 🏝️',
    'O mică aventură cu numere te așteaptă azi. Hai să jucăm? 🧩',
    'Insula de azi are câteva surprize pentru tine. 🗺️',
    'Trei minute, un zâmbet și o idee nouă. Te așteptăm! ✨',
    'Azi e o zi bună pentru puțină joacă cu numerele. 🔢',
    'Un joc scurt ți-a pregătit ceva frumos. Vii să vezi? 🎈',
    'Hai să descoperim împreună ce e nou în Ludiko azi. 🌟',
    'Există un colț de joacă pregătit pentru tine. Ne vedem acolo? 🐞',
    'Încălzirea de azi e gata: câteva minute de joacă. 🚀',
    'Pentru un moment vesel cu numere, intră în Ludiko. 🎲',
  ],
  en: [
    "Today's bit is ready — 3 minutes of play! 🏝️",
    'A short maths adventure is waiting for you today. Shall we play? 🧩',
    "Today's island has a few surprises for you. 🗺️",
    "Three minutes, a smile and a fresh idea. We're here when you are! ✨",
    'A good day for a little play with numbers. 🔢',
    'A short game has something nice ready for you. Want to take a peek? 🎈',
    "Let's discover what's new in Ludiko today, together. 🌟",
    "There's a little play corner ready for you. See you there? 🐞",
    "Today's warm-up is ready: a few minutes of play. 🚀",
    'For a moment of number fun, step into Ludiko. 🎲',
  ],
};

/**
 * Local calendar day ('YYYY-MM-DD') and hour (0-23) of `now` in an IANA timezone.
 * An invalid or missing timezone falls back to DEFAULT_TIMEZONE.
 */
export function localDayAndHour(now, timezone) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  };
  // Intl treats an undefined timeZone as the host zone, so validate explicitly.
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
  };
}

/** True when `timezone` is a string that Intl accepts as an IANA zone. */
export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || timezone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a reminder is due for a `pushSubscriptions` document at `now`.
 * Contract §4: active, local hour equals the chosen hour (8-20), not played today, not sent today.
 * Missing or malformed fields mean "not due". A missing or invalid timezone is also "not due".
 */
export function isDue(sub, now) {
  if (!sub || typeof sub !== 'object') return false;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  if (sub.active !== true) return false;
  if (!Number.isInteger(sub.hour) || sub.hour < MIN_HOUR || sub.hour > MAX_HOUR) return false;
  if (!isValidTimezone(sub.timezone)) return false;

  const { day, hour } = localDayAndHour(now, sub.timezone);
  if (hour !== sub.hour || hour < MIN_HOUR || hour > MAX_HOUR) return false;
  if (sub.lastPlayedDay === day) return false;
  if (sub.lastSentDay === day) return false;
  return true;
}

/** Subscriptions not updated for this long are deleted (F7, docs/PRIVACY_DATA_MAP.md). */
export const SUBSCRIPTION_RETENTION_MONTHS = 12;

/**
 * Epoch milliseconds before which a subscription's `updatedAt` means "expired".
 * Calendar months, in UTC (for example, 2026-11-26 gives 2025-11-26 at the same time of day).
 */
export function subscriptionExpiryCutoff(now) {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - SUBSCRIPTION_RETENTION_MONTHS);
  return d.getTime();
}

/**
 * Whether a `pushSubscriptions` document has expired: its numeric `updatedAt` (epoch ms, written by
 * the client on every change and by the sender on every send) is older than the retention cutoff.
 * A document without a numeric `updatedAt` is never treated as expired by this rule.
 */
export function isSubscriptionExpired(sub, now) {
  if (!sub || typeof sub !== 'object') return false;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  if (typeof sub.updatedAt !== 'number' || !Number.isFinite(sub.updatedAt)) return false;
  return sub.updatedAt < subscriptionExpiryCutoff(now);
}

/** Day of the year (1-366) for a 'YYYY-MM-DD' string; 0 when malformed. */
export function dayOfYear(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof day === 'string' ? day : '');
  if (!m) return 0;
  const [year, month, date] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(year, month - 1, date) - Date.UTC(year, 0, 1);
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Notification payload for a language and local day. Deterministic: the same (lang, day)
 * always gives the same message, and consecutive days rotate through the list.
 * Unknown languages fall back to Romanian, the app default.
 */
export function pickMessage(lang, day) {
  const code = lang === 'en' ? 'en' : 'ro';
  const list = MESSAGES[code];
  const body = list[dayOfYear(day) % list.length];
  return { title: TITLE[code], body, url: REMINDER_URL, tag: REMINDER_TAG };
}

/**
 * Normalise the VAPID subject. web-push requires a URL: `mailto:…` or `https://…`.
 * Owners often paste a bare email, or a value with stray spaces/quotes/newlines — fix those.
 * Returns null when the value cannot be turned into a valid subject.
 */
export function normalizeVapidSubject(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!s) return null;
  if (/^mailto:/i.test(s)) s = 'mailto:' + s.slice(7).trim();
  else if (/^https:\/\//i.test(s)) return s;
  else if (/^[^\s@:]+@[^\s@]+\.[^\s@]+$/.test(s)) s = 'mailto:' + s;
  else return null;
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s) ? s : null;
}

/**
 * Hosts of the browser push services (Google FCM, Mozilla autopush, Apple, Windows WNS). The sender only POSTs to these,
 * mirroring firestore.rules `pushSubscriptions`, so a forged subscription cannot aim the job at an arbitrary
 * server (docs/SECURITY.md S-01).
 */
export const PUSH_ENDPOINT_PATTERN =
  /^https:\/\/(([a-z0-9-]+\.)*googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/.+$/;

export function isAllowedPushEndpoint(endpoint) {
  return typeof endpoint === 'string' && endpoint.length <= 1024 && PUSH_ENDPOINT_PATTERN.test(endpoint);
}
