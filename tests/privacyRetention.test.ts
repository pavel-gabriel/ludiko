import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  monthsBefore,
  reportRetentionDecision,
  runCleanupReports,
} from '../scripts/privacy/cleanup-reports.mjs';

// F6: content reports are kept 12 months after closing and at most 24 months (docs/PRIVACY_DATA_MAP.md).
const NOW = new Date('2026-11-26T10:00:00Z');
const ROOT = join(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'privacy', 'cleanup-reports.mjs');

describe('reportRetentionDecision (F6)', () => {
  const at = (months: number) => monthsBefore(NOW, months) + 60_000; // just inside the window

  it('deletes resolved and dismissed reports older than 12 months', () => {
    expect(reportRetentionDecision({ status: 'resolved', createdAt: at(13) }, NOW)).toBe('delete');
    expect(reportRetentionDecision({ status: 'dismissed', createdAt: at(13) }, NOW)).toBe('delete');
  });

  it('keeps closed reports younger than 12 months', () => {
    expect(reportRetentionDecision({ status: 'resolved', createdAt: at(11) }, NOW)).toBe('keep');
    expect(reportRetentionDecision({ status: 'dismissed', createdAt: at(1) }, NOW)).toBe('keep');
  });

  it('keeps open reports between 12 and 24 months old', () => {
    expect(reportRetentionDecision({ status: 'open', createdAt: at(18) }, NOW)).toBe('keep');
    expect(reportRetentionDecision({ status: 'open', createdAt: at(23) }, NOW)).toBe('keep');
  });

  it('deletes any report older than 24 months, whatever its status', () => {
    expect(reportRetentionDecision({ status: 'open', createdAt: at(25) }, NOW)).toBe('delete');
    expect(reportRetentionDecision({ status: 'resolved', createdAt: at(25) }, NOW)).toBe('delete');
  });

  it('keeps malformed or unaged documents', () => {
    expect(reportRetentionDecision({ status: 'resolved' }, NOW)).toBe('keep');
    expect(reportRetentionDecision({ status: 'resolved', createdAt: '2020-01-01' }, NOW)).toBe('keep');
    expect(reportRetentionDecision(null, NOW)).toBe('keep');
    expect(reportRetentionDecision({ status: 'resolved', createdAt: 1 }, new Date('bad'))).toBe('keep');
  });
});

type Row = { id: string; data: Record<string, unknown> };

/** In-memory Firestore stand-in: range filter on createdAt, cursor paging, batch deletes. */
function fakeDb(rows: Row[]) {
  const store = new Map(rows.map((r) => [r.id, { ...r.data }]));
  const committed: string[][] = [];
  const FieldPath = { documentId: () => '__name__' };

  function query(filter: { field: string; value: number } | null, limit = Infinity, after: string | null = null) {
    return {
      where: (field: string, _op: string, value: number) => query({ field, value }, limit, after),
      orderBy: () => query(filter, limit, after),
      limit: (n: number) => query(filter, n, after),
      startAfter: (snap: { id: string }) => query(filter, limit, snap.id),
      get: async () => {
        let ids = [...store.keys()]
          .filter((id) => {
            if (!filter) return true;
            const v = store.get(id)![filter.field];
            return typeof v === 'number' && v < filter.value;
          })
          .sort();
        if (after !== null) ids = ids.filter((id) => id > after);
        const docs = ids.slice(0, limit).map((id) => ({
          id,
          data: () => ({ ...store.get(id)! }),
          ref: { id },
        }));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
  }

  const db = {
    collection: () => query(null),
    batch: () => {
      const ids: string[] = [];
      return {
        delete: (ref: { id: string }) => {
          ids.push(ref.id);
        },
        commit: async () => {
          committed.push([...ids]);
          ids.forEach((id) => store.delete(id));
        },
      };
    },
  };
  return { db, FieldPath, store, committed };
}

const report = (id: string, createdAt: number, status: string) => ({ id, data: { createdAt, status, itemId: 'x' } });

describe('runCleanupReports (F6)', () => {
  const rows = () => [
    report('closedOld', monthsBefore(NOW, 14), 'resolved'),
    report('dismissedOld', monthsBefore(NOW, 13), 'dismissed'),
    report('openOld', monthsBefore(NOW, 18), 'open'),
    report('closedRecent', monthsBefore(NOW, 3), 'resolved'),
    report('ancientOpen', monthsBefore(NOW, 30), 'open'),
  ];
  const env = { FIREBASE_SERVICE_ACCOUNT: '{"project_id":"test"}' };

  function run(argv: string[]) {
    const fake = fakeDb(rows());
    const deps = {
      firebase: vi.fn(async () => ({ db: fake.db, FieldPath: fake.FieldPath })),
    };
    const logs: string[] = [];
    const errors: string[] = [];
    const promise = runCleanupReports({ env, argv, now: NOW, log: (m) => logs.push(m), error: (m) => errors.push(m), deps });
    return { promise, fake, logs, errors, deps };
  }

  it('dry run counts what would be deleted and deletes nothing', async () => {
    const t = run(['--dry-run']);
    const { exitCode, summary } = await t.promise;
    expect(exitCode).toBe(0);
    expect(summary).toEqual({ scanned: 4, closedOver12Months: 2, olderThan24Months: 1, deleted: 0 });
    expect(t.fake.committed).toEqual([]);
    expect(t.fake.store.size).toBe(5);
    expect(t.logs.join('\n')).toContain('to-delete=3');
    expect(t.logs.join('\n')).toContain('dry run');
  });

  it('real run deletes closed-over-12-months and over-24-months reports only', async () => {
    const t = run([]);
    const { exitCode, summary } = await t.promise;
    expect(exitCode).toBe(0);
    expect(summary?.deleted).toBe(3);
    expect([...t.fake.store.keys()].sort()).toEqual(['closedRecent', 'openOld']);
  });

  it('never logs comments, item ids or report ids', async () => {
    const t = run(['--dry-run']);
    await t.promise;
    expect(t.logs.join('\n')).not.toMatch(/closedOld|itemId|comment/);
  });

  it('fails without a service account and never touches Firebase', async () => {
    const fake = fakeDb(rows());
    const deps = { firebase: vi.fn(async () => ({ db: fake.db, FieldPath: fake.FieldPath })) };
    const errors: string[] = [];
    const { exitCode } = await runCleanupReports({ env: {}, now: NOW, log: () => {}, error: (m) => errors.push(m), deps });
    expect(exitCode).toBe(1);
    expect(deps.firebase).not.toHaveBeenCalled();
    expect(errors.join('\n')).toContain('FIREBASE_SERVICE_ACCOUNT');
  });

  it('script exits 1 with a clear message when the secret is missing (real process)', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--dry-run'], { env: {}, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FIREBASE_SERVICE_ACCOUNT is not set');
  });
});
