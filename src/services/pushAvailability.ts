/**
 * Cheap, synchronous gates for push reminders (docs/NOTIFICATIONS.md §2).
 *
 * This file must stay tiny and must NOT import Firebase: the learner screens use it to decide whether
 * to load `pushService` (and with it the Firebase chunk) at all.
 */

/** localStorage key written by pushService.subscribe; JSON of PushLocalState */
export const PUSH_STATE_KEY = 'ludiko.push.v1';

export interface PushLocalState {
  /** Firestore document id = sha-256 hex of the endpoint */
  id: string;
  hour: number;
  lang: 'ro' | 'en';
  active: boolean;
}

export function readPushState(): PushLocalState | null {
  try {
    const raw = localStorage.getItem(PUSH_STATE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PushLocalState>;
    if (typeof v.id !== 'string' || typeof v.hour !== 'number') return null;
    return { id: v.id, hour: v.hour, lang: v.lang === 'en' ? 'en' : 'ro', active: v.active !== false };
  } catch {
    return null;
  }
}

export function writePushState(state: PushLocalState | null): void {
  try {
    if (state) localStorage.setItem(PUSH_STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(PUSH_STATE_KEY);
  } catch {
    /* storage unavailable: the card just forgets its settings */
  }
}

/** This device has a stored subscription worth touching after a bit */
export function hasPushSubscription(): boolean {
  return readPushState() !== null;
}

/** Build-time configuration: a VAPID public key and Firebase (where subscriptions are stored) */
export function pushConfigured(): boolean {
  const env = import.meta.env;
  return Boolean(env.VITE_VAPID_PUBLIC_KEY && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with a touch screen
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

/** iOS only delivers web push to apps added to the Home Screen: show a hint instead of the controls */
export function needsInstall(): boolean {
  return pushConfigured() && isIos() && !isStandalone();
}

/** Configured and the browser can do Web Push (Push API, Notifications, service worker) */
export function isPushSupported(): boolean {
  if (!pushConfigured() || typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
