/**
 * Daily push reminders, client side (docs/NOTIFICATIONS.md).
 *
 * Standard Web Push + VAPID. The subscription lives in Firestore `pushSubscriptions/{sha256(endpoint)}`
 * (no personal data). Only import this module dynamically (parent page, after a bit): it pulls in Firebase.
 */
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ensureAnonymousAuth } from '@/services/authService';
import { db } from '@/services/firebase';
import {
  isIos,
  isPushSupported,
  needsInstall,
  pushConfigured,
  readPushState,
  writePushState,
  type PushLocalState,
} from '@/services/pushAvailability';

export { isIos, isPushSupported, needsInstall, pushConfigured };

export const PUSH_COLLECTION = 'pushSubscriptions';
export const PUSH_HOUR_MIN = 8;
export const PUSH_HOUR_MAX = 20;
export const PUSH_DEFAULT_HOUR = 17;
const READY_TIMEOUT_MS = 8000;

export type PushLang = 'ro' | 'en';

/** The Firestore document, exactly as in docs/NOTIFICATIONS.md §3 (`lastSentDay` is written only by the sender) */
export interface PushSubscriptionDoc {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  hour: number;
  timezone: string;
  lang: PushLang;
  active: boolean;
  lastPlayedDay?: string;
  createdAt: number;
  updatedAt: number;
}

export type PushErrorCode = 'unsupported' | 'denied' | 'no-service-worker' | 'invalid-hour' | 'failed';
export class PushError extends Error {
  constructor(public code: PushErrorCode, cause?: unknown) {
    super(`push: ${code}`);
    this.name = 'PushError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on' | 'paused';

export interface PushStatus {
  state: PushState;
  hour: number;
  lang: PushLang;
}

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

export function isValidHour(hour: unknown): hour is number {
  return typeof hour === 'number' && Number.isInteger(hour) && hour >= PUSH_HOUR_MIN && hour <= PUSH_HOUR_MAX;
}

/** Lowercase hex SHA-256 (the document id is the hash of the endpoint) */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Local calendar day, YYYY-MM-DD */
export function localDay(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** VAPID public key (base64url) -> bytes for PushManager.subscribe */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new PushError('no-service-worker')), READY_TIMEOUT_MS),
  );
  return Promise.race([ready, timeout]);
}

function pushLang(lang: string): PushLang {
  return lang.startsWith('en') ? 'en' : 'ro';
}

/* ------------------------------------------------------------------ */
/*  API                                                               */
/* ------------------------------------------------------------------ */

/** What the parent card should show. Never throws. */
export async function getStatus(): Promise<PushStatus> {
  const stored = readPushState();
  const base = { hour: stored?.hour ?? PUSH_DEFAULT_HOUR, lang: stored?.lang ?? 'ro' };
  if (needsInstall() && !isPushSupported()) return { ...base, state: 'needs-install' };
  if (!isPushSupported()) return { ...base, state: 'unsupported' };
  if (Notification.permission === 'denied') return { ...base, state: 'denied' };
  if (!stored) return { ...base, state: 'off' };
  try {
    const sub = await (await readyRegistration()).pushManager.getSubscription();
    if (!sub) {
      writePushState(null); // revoked in the browser: forget it
      return { hour: PUSH_DEFAULT_HOUR, lang: base.lang, state: 'off' };
    }
  } catch {
    /* cannot check (offline, no SW): trust the stored state */
  }
  return { ...base, state: stored.active ? 'on' : 'paused' };
}

/** Ask permission, subscribe this device and store the document. Throws PushError. */
export async function subscribe(hour: number, lang: string): Promise<PushStatus> {
  if (!isPushSupported()) throw new PushError('unsupported');
  if (!isValidHour(hour)) throw new PushError('invalid-hour');
  if ((await Notification.requestPermission()) !== 'granted') throw new PushError('denied');

  const registration = await readyRegistration();
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string) as BufferSource,
    });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new PushError('failed');

  const now = Date.now();
  const id = await sha256Hex(json.endpoint);
  const payload: PushSubscriptionDoc = {
    endpoint: json.endpoint,
    keys: { p256dh, auth },
    hour,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: pushLang(lang),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await ensureAnonymousAuth();
    // merge: a returning device keeps the sender's lastSentDay and its own lastPlayedDay
    await setDoc(doc(db, PUSH_COLLECTION, id), payload, { merge: true });
  } catch (e) {
    throw new PushError('failed', e);
  }
  writePushState({ id, hour, lang: payload.lang, active: true });
  return { state: 'on', hour, lang: payload.lang };
}

/** Delete the document and unsubscribe this device. Best effort: a stale document is removed by the sender on 404/410. */
export async function unsubscribe(): Promise<void> {
  const stored = readPushState();
  let sub: PushSubscription | null = null;
  try {
    sub = await (await readyRegistration()).pushManager.getSubscription();
  } catch {
    /* no service worker: nothing to unsubscribe in the browser */
  }
  const id = stored?.id ?? (sub ? await sha256Hex(sub.endpoint) : undefined);
  try {
    if (id) {
      await ensureAnonymousAuth();
      await deleteDoc(doc(db, PUSH_COLLECTION, id));
    }
  } catch {
    /* offline: the sender drops the document once the push service answers 404/410 */
  }
  try {
    await sub?.unsubscribe();
  } finally {
    writePushState(null);
  }
}

/** Change the hour, pause/resume or the language of an existing subscription */
export async function updateSettings(patch: { hour?: number; active?: boolean; lang?: string }): Promise<PushStatus> {
  const stored = readPushState();
  if (!stored) throw new PushError('failed');
  if (patch.hour !== undefined && !isValidHour(patch.hour)) throw new PushError('invalid-hour');
  const next: PushLocalState = {
    id: stored.id,
    hour: patch.hour ?? stored.hour,
    lang: patch.lang ? pushLang(patch.lang) : stored.lang,
    active: patch.active ?? stored.active,
  };
  try {
    await ensureAnonymousAuth();
    await updateDoc(doc(db, PUSH_COLLECTION, stored.id), {
      hour: next.hour,
      lang: next.lang,
      active: next.active,
      updatedAt: Date.now(),
    });
  } catch (e) {
    throw new PushError('failed', e);
  }
  writePushState(next);
  return { state: next.active ? 'on' : 'paused', hour: next.hour, lang: next.lang };
}

/** A bit was finished today: tell the sender not to remind. No-op unless this device is subscribed. Never throws. */
export async function markPlayedToday(now: number = Date.now()): Promise<void> {
  const stored = readPushState();
  if (!stored || !isPushSupported()) return;
  try {
    await ensureAnonymousAuth();
    await updateDoc(doc(db, PUSH_COLLECTION, stored.id), { lastPlayedDay: localDay(now), updatedAt: now });
  } catch {
    /* offline or the document is gone: a missed update only costs one extra reminder */
  }
}
