// One-time owner cleanup for privacy finding F1: deletes every document in Firestore `gameHistory`
// (names typed by children in the old cloud leaderboard). See docs/PRIVACY_DATA_MAP.md.
//
// Usage:  FIREBASE_SERVICE_ACCOUNT='<service account JSON>' node scripts/privacy/delete-game-history.mjs [--dry-run]
//   --dry-run  only counts the documents, deletes nothing.
// Never logs document contents or ids: only counts.

import { fileURLToPath } from 'node:url';

export const COLLECTION = 'gameHistory';
export const BATCH_SIZE = 500;

const defaultLoaders = {
  async firestore(serviceAccountJson) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    return getFirestore(app);
  },
};

/** Deletes (or, with dryRun, only counts) all documents in batches of 500. Returns the count. */
export async function deleteGameHistory(db, { dryRun = false, log = () => {} } = {}) {
  let total = 0;
  for (;;) {
    const snap = await db.collection(COLLECTION).limit(BATCH_SIZE).get();
    if (snap.empty) break;
    total += snap.size;
    if (dryRun) {
      // Without deleting, paging would loop forever: count the rest page by page, then stop.
      let last = snap.docs[snap.docs.length - 1];
      while (snap.size === BATCH_SIZE) {
        const next = await db.collection(COLLECTION).startAfter(last).limit(BATCH_SIZE).get();
        if (next.empty) break;
        total += next.size;
        last = next.docs[next.docs.length - 1];
        if (next.size < BATCH_SIZE) break;
      }
      break;
    }
    const batch = db.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    log(`deleted ${total} so far`);
  }
  return total;
}

export async function main({ env = process.env, argv = process.argv.slice(2), loaders = defaultLoaders, log = console.log } = {}) {
  const dryRun = argv.includes('--dry-run');
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    log('FIREBASE_SERVICE_ACCOUNT is not set: nothing done.');
    return 1;
  }
  const db = await loaders.firestore(env.FIREBASE_SERVICE_ACCOUNT);
  const n = await deleteGameHistory(db, { dryRun, log });
  log(dryRun ? `dry run: ${n} document(s) would be deleted` : `done: ${n} document(s) deleted`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code), (e) => {
    console.error('failed:', e?.code ?? 'error'); // never print contents
    process.exit(1);
  });
}
