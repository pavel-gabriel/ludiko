// Daily push reminders sender (docs/NOTIFICATIONS.md §4). CI-only: run by the `reminders` job in .github/workflows/deploy.yml.
// Usage: node scripts/send-daily-reminders.mjs [--dry-run]
//
// Required env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, FIREBASE_SERVICE_ACCOUNT (JSON).
// If any is missing the script logs a notice and exits 0 without touching Firebase.
// Never logs endpoints, keys or personal data: only the endpoint host and HTTP status codes.
// Also deletes subscriptions whose updatedAt is older than 12 months (F7; counted only with --dry-run).

import { fileURLToPath } from 'node:url';
import {
  localDayAndHour,
  isDue,
  isSubscriptionExpired,
  pickMessage,
  subscriptionExpiryCutoff,
  normalizeVapidSubject,
} from './reminders/logic.mjs';

export const PAGE_SIZE = 500;
export const CONCURRENCY = 20;
export const TTL_SECONDS = 6 * 60 * 60;
export const COLLECTION = 'pushSubscriptions';

const REQUIRED_ENV = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'FIREBASE_SERVICE_ACCOUNT'];

const defaultLoaders = {
  async firebase(serviceAccountJson) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldPath } = await import('firebase-admin/firestore');
    const app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    return { db: getFirestore(app), FieldPath };
  },
  async webPush() {
    return import('web-push');
  },
};

/** Async generator over active subscription snapshots, PAGE_SIZE per Firestore query. */
export async function* activeSubscriptionPages(db, FieldPath, pageSize = PAGE_SIZE) {
  let cursor = null;
  for (;;) {
    let query = db
      .collection(COLLECTION)
      .where('active', '==', true)
      .orderBy(FieldPath.documentId())
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) return;
    yield snap.docs;
    if (snap.size < pageSize) return;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

/**
 * Async generator over subscriptions whose `updatedAt` is before `cutoff` (any `active` value), PAGE_SIZE per query.
 * Ordered by updatedAt then document id, so the cursor is stable while documents are deleted.
 */
export async function* expiredSubscriptionPages(db, FieldPath, cutoff, pageSize = PAGE_SIZE) {
  let cursor = null;
  for (;;) {
    let query = db
      .collection(COLLECTION)
      .where('updatedAt', '<', cutoff)
      .orderBy('updatedAt')
      .orderBy(FieldPath.documentId())
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) return;
    yield snap.docs;
    if (snap.size < pageSize) return;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

/**
 * Deletes subscriptions not updated for SUBSCRIPTION_RETENTION_MONTHS (F7). Dry run only counts them.
 * Returns the number of expired documents found (deleted, or that would be deleted in a dry run).
 */
export async function expireStaleSubscriptions(db, FieldPath, now, { dryRun = false } = {}) {
  const cutoff = subscriptionExpiryCutoff(now);
  let expired = 0;
  for await (const docs of expiredSubscriptionPages(db, FieldPath, cutoff)) {
    const stale = docs.filter((doc) => isSubscriptionExpired(doc.data(), now));
    expired += stale.length;
    if (dryRun) continue;
    await mapWithConcurrency(stale, CONCURRENCY, async (doc) => {
      await doc.ref.delete();
    });
  }
  return expired;
}

/** Runs `worker` over `items` with at most `limit` in flight. */
export async function mapWithConcurrency(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function isValidSubscription(sub) {
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length === 0 || sub.endpoint.length > 1024) return false;
  if (!sub.endpoint.startsWith('https://')) return false;
  return typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string';
}

function endpointHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid-endpoint';
  }
}

/**
 * Entry point. Returns { exitCode, summary } and never calls process.exit itself, so it can be tested.
 * `deps` lets tests inject fakes; by default Firebase and web-push are loaded only when secrets exist.
 */
export async function runReminders({
  env = process.env,
  argv = process.argv.slice(2),
  now = new Date(),
  log = console.log,
  error = console.error,
  deps = defaultLoaders,
} = {}) {
  const dryRun = argv.includes('--dry-run');

  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    log('reminders disabled: missing secrets');
    return { exitCode: 0, summary: null };
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return { exitCode: 1, summary: null };
  }

  const summary = { checked: 0, due: 0, sent: 0, removed: 0, failed: 0, expired: 0 };
  log(dryRun ? 'daily reminders: dry run (no sends, no writes)' : 'daily reminders: sending');

  try {
    const { db, FieldPath } = await deps.firebase(JSON.stringify(serviceAccount));
    const webpush = await deps.webPush();
    const subject = normalizeVapidSubject(env.VAPID_SUBJECT);
    if (!subject) {
      error('VAPID_SUBJECT must be an email (e.g. you@example.com or mailto:you@example.com) or an https:// URL');
      return { exitCode: 1, summary: null };
    }
    webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY.trim(), env.VAPID_PRIVATE_KEY.trim());

    for await (const docs of activeSubscriptionPages(db, FieldPath)) {
      summary.checked += docs.length;
      const due = docs.filter((doc) => isDue(doc.data(), now));
      summary.due += due.length;
      if (dryRun) continue;

      await mapWithConcurrency(due, CONCURRENCY, async (doc) => {
        const sub = doc.data();
        if (!isValidSubscription(sub)) {
          summary.failed += 1;
          error(`skipped ${doc.id}: malformed subscription document`);
          return;
        }
        const { day } = localDayAndHour(now, sub.timezone);
        const payload = JSON.stringify(pickMessage(sub.lang, day));
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
            payload,
            { TTL: TTL_SECONDS, urgency: 'normal' },
          );
          await doc.ref.update({ lastSentDay: day, updatedAt: Date.now() });
          summary.sent += 1;
        } catch (err) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            await doc.ref.delete();
            summary.removed += 1;
          } else {
            summary.failed += 1;
            error(`push to ${endpointHost(sub.endpoint)} failed: ${status ?? err?.name ?? 'unknown error'}`);
          }
        }
      });
    }

    summary.expired = await expireStaleSubscriptions(db, FieldPath, now, { dryRun });
  } catch (err) {
    error(`daily reminders aborted: ${err?.message ?? err}`);
    return { exitCode: 1, summary };
  }

  log(
    `summary: checked=${summary.checked} due=${summary.due} sent=${summary.sent} ` +
      `removed=${summary.removed} failed=${summary.failed} ` +
      `expired=${summary.expired}${dryRun ? ' (dry run, not deleted)' : ''}`,
  );
  return { exitCode: 0, summary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { exitCode } = await runReminders();
  /* Firebase clients keep sockets open; exit explicitly so the CI job ends */
  process.exit(exitCode);
}
