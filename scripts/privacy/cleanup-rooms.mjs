// Owner-run cleanup of old multiplayer rooms (docs/PRIVACY_DATA_MAP.md F2). Optional: the app already deletes the
// rooms it created when the host leaves or disconnects and refuses to join rooms older than 6 hours; this removes
// what was left behind (a crashed tab, a lost connection).
//
// Usage: node scripts/privacy/cleanup-rooms.mjs [--dry-run] [--max-age-hours=24]
//
// Required env: FIREBASE_SERVICE_ACCOUNT (the service-account JSON), FIREBASE_DATABASE_URL
//   (e.g. https://ludiko-2e197-default-rtdb.europe-west1.firebasedatabase.app).
// It only reads `createdAt` fields to decide, deletes rooms/{id} and roomCodes/{CODE} older than the limit, and
// logs counts only (never names or ids of players).

import { fileURLToPath } from 'node:url';

export const DEFAULT_MAX_AGE_HOURS = 24;

/** Keys of `entries` (a map of {createdAt}) older than the limit. Entries without a numeric createdAt count as stale. */
export function staleKeys(entries, now, maxAgeMs) {
  return Object.entries(entries ?? {})
    .filter(([, v]) => typeof v?.createdAt !== 'number' || now - v.createdAt > maxAgeMs)
    .map(([k]) => k);
}

export function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const arg = argv.find((a) => a.startsWith('--max-age-hours='));
  const hours = arg ? Number(arg.split('=')[1]) : DEFAULT_MAX_AGE_HOURS;
  if (!Number.isFinite(hours) || hours < 1) throw new Error('--max-age-hours must be a number >= 1');
  return { dryRun, maxAgeMs: hours * 3600 * 1000 };
}

/** Core: `db` is a firebase-admin Database. Returns the counts. */
export async function cleanupRooms(db, { dryRun, maxAgeMs, now = Date.now() }) {
  const rooms = (await db.ref('rooms').once('value')).val() ?? {};
  const codes = (await db.ref('roomCodes').once('value')).val() ?? {};
  const staleRooms = staleKeys(rooms, now, maxAgeMs);
  const staleCodes = staleKeys(codes, now, maxAgeMs);
  if (!dryRun) {
    const updates = {};
    for (const id of staleRooms) updates[`rooms/${id}`] = null;
    for (const code of staleCodes) updates[`roomCodes/${code}`] = null;
    if (Object.keys(updates).length > 0) await db.ref().update(updates);
  }
  return { rooms: Object.keys(rooms).length, staleRooms: staleRooms.length, codes: Object.keys(codes).length, staleCodes: staleCodes.length };
}

async function main() {
  const { dryRun, maxAgeMs } = parseArgs(process.argv.slice(2));
  const { FIREBASE_SERVICE_ACCOUNT, FIREBASE_DATABASE_URL } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT || !FIREBASE_DATABASE_URL) {
    console.log('FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL are required; nothing done.');
    return;
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getDatabase } = await import('firebase-admin/database');
  const app = initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)), databaseURL: FIREBASE_DATABASE_URL });
  const result = await cleanupRooms(getDatabase(app), { dryRun, maxAgeMs });
  console.log(`${dryRun ? '[dry run] would delete' : 'Deleted'} ${result.staleRooms} of ${result.rooms} rooms and ${result.staleCodes} of ${result.codes} room codes.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
