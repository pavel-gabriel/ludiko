// Retention for content reports (F6, docs/PRIVACY_DATA_MAP.md). Owner-run, not scheduled.
// Usage: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/privacy/cleanup-reports.mjs [--dry-run]
//
// Deletes contentReports/{id} when:
//   - createdAt is older than 24 months (any status), or
//   - createdAt is older than 12 months and status is "resolved" or "dismissed".
// Open reports older than 12 months are kept until they are resolved or dismissed.
// Needs a service account with the "Cloud Datastore User" role. --dry-run only counts.
// Never logs comments, item ids or document contents: only counts.

import { fileURLToPath } from 'node:url';

export const COLLECTION = 'contentReports';
export const PAGE_SIZE = 300;
export const CLOSED_RETENTION_MONTHS = 12;
export const MAX_RETENTION_MONTHS = 24;
const CLOSED_STATUSES = ['resolved', 'dismissed'];

/** Epoch ms of `now` minus `months` calendar months (UTC). */
export function monthsBefore(now, months) {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

/**
 * Pure retention decision for one report: 'delete' or 'keep'.
 * A report without a numeric createdAt is kept (it cannot be aged; the rules require createdAt).
 */
export function reportRetentionDecision(report, now) {
  if (!report || typeof report !== 'object') return 'keep';
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return 'keep';
  if (typeof report.createdAt !== 'number' || !Number.isFinite(report.createdAt)) return 'keep';
  if (report.createdAt < monthsBefore(now, MAX_RETENTION_MONTHS)) return 'delete';
  if (report.createdAt < monthsBefore(now, CLOSED_RETENTION_MONTHS) && CLOSED_STATUSES.includes(report.status)) {
    return 'delete';
  }
  return 'keep';
}

const defaultLoaders = {
  async firebase(serviceAccountJson) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldPath } = await import('firebase-admin/firestore');
    const app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    return { db: getFirestore(app), FieldPath };
  },
};

/**
 * Pages through reports older than the 12-month cutoff (a superset of what may be deleted).
 * Ordered by createdAt then document id, so the cursor stays valid while documents are deleted.
 */
export async function* oldReportPages(db, FieldPath, now, pageSize = PAGE_SIZE) {
  const cutoff = monthsBefore(now, CLOSED_RETENTION_MONTHS);
  let cursor = null;
  for (;;) {
    let query = db
      .collection(COLLECTION)
      .where('createdAt', '<', cutoff)
      .orderBy('createdAt')
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
 * Entry point. Returns { exitCode, summary } and never calls process.exit itself, so it can be tested.
 */
export async function runCleanupReports({
  env = process.env,
  argv = process.argv.slice(2),
  now = new Date(),
  log = console.log,
  error = console.error,
  deps = defaultLoaders,
} = {}) {
  const dryRun = argv.includes('--dry-run');
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    error('FIREBASE_SERVICE_ACCOUNT is not set (JSON of a service account with the "Cloud Datastore User" role)');
    return { exitCode: 1, summary: null };
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return { exitCode: 1, summary: null };
  }

  const summary = { scanned: 0, closedOver12Months: 0, olderThan24Months: 0, deleted: 0 };
  log(dryRun ? 'report cleanup: dry run (no deletes)' : 'report cleanup: deleting');

  try {
    const { db, FieldPath } = await deps.firebase(JSON.stringify(serviceAccount));
    for await (const docs of oldReportPages(db, FieldPath, now)) {
      summary.scanned += docs.length;
      const doomed = [];
      for (const doc of docs) {
        const decision = reportRetentionDecision(doc.data(), now);
        if (decision !== 'delete') continue;
        doomed.push(doc);
        const data = doc.data();
        if (data.createdAt < monthsBefore(now, MAX_RETENTION_MONTHS)) summary.olderThan24Months += 1;
        else summary.closedOver12Months += 1;
      }
      if (dryRun || doomed.length === 0) continue;
      const batch = db.batch();
      for (const doc of doomed) batch.delete(doc.ref);
      await batch.commit();
      summary.deleted += doomed.length;
    }
  } catch (err) {
    error(`report cleanup aborted: ${err?.message ?? err}`);
    return { exitCode: 1, summary };
  }

  const wouldDelete = summary.closedOver12Months + summary.olderThan24Months;
  log(
    `summary: scanned=${summary.scanned} to-delete=${wouldDelete} ` +
      `(closed-over-12-months=${summary.closedOver12Months}, over-24-months=${summary.olderThan24Months}) ` +
      (dryRun ? 'deleted=0 (dry run)' : `deleted=${summary.deleted}`),
  );
  return { exitCode: 0, summary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { exitCode } = await runCleanupReports();
  /* Firebase clients keep sockets open; exit explicitly so the CI job ends */
  process.exit(exitCode);
}
