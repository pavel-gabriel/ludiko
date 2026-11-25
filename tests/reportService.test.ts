import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addDoc } from 'firebase/firestore';
import {
  AUTO_HIDE_REPORT_THRESHOLD,
  MAX_COMMENT_LENGTH,
  MAX_QUEUE_SIZE,
  RIGHTS_HIDE_THRESHOLD,
  flushQueuedReports,
  getQueuedReportCount,
  groupOpenReports,
  isItemHidden,
  submitReport,
  validateReportInput,
  type ContentReport,
} from '@/services/reportService';

/* Firebase is toggled per test through this mutable flag. */
const fb = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/services/firebase', () => ({
  db: {},
  get firebaseEnabled() {
    return fb.enabled;
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  addDoc: vi.fn(async () => ({ id: 'mock-id' })),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((ref: unknown) => ref),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

const QUEUE_KEY = 'ludiko.contentReportQueue.v1';

function report(partial: Partial<ContentReport> & { itemId: string }): ContentReport {
  return {
    id: Math.random().toString(36).slice(2),
    reason: 'wrong-answer',
    createdAt: 1,
    status: 'open',
    ...partial,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(addDoc).mockReset();
  fb.enabled = false;
});

/* ------------------------------------------------------------------ */
/*  Hiding thresholds                                                  */
/* ------------------------------------------------------------------ */

describe('isItemHidden', () => {
  it('exports the thresholds', () => {
    expect(AUTO_HIDE_REPORT_THRESHOLD).toBe(2);
    expect(RIGHTS_HIDE_THRESHOLD).toBe(1);
  });

  it('is not hidden with zero reports', () => {
    expect(isItemHidden([], 'a1')).toBe(false);
  });

  it('is not hidden with one open report', () => {
    expect(isItemHidden([report({ itemId: 'a1' })], 'a1')).toBe(false);
  });

  it('is hidden with two open reports', () => {
    const reports = [
      report({ itemId: 'a1', reason: 'unclear' }),
      report({ itemId: 'a1', reason: 'typo' }),
    ];
    expect(isItemHidden(reports, 'a1')).toBe(true);
  });

  it('is hidden immediately by one open rights report', () => {
    expect(isItemHidden([report({ itemId: 'a1', reason: 'rights' })], 'a1')).toBe(true);
  });

  it('does not count resolved or dismissed reports', () => {
    const reports = [
      report({ itemId: 'a1', status: 'open' }),
      report({ itemId: 'a1', status: 'resolved' }),
      report({ itemId: 'a1', status: 'dismissed' }),
    ];
    expect(isItemHidden(reports, 'a1')).toBe(false);
  });

  it('ignores resolved rights reports', () => {
    expect(
      isItemHidden([report({ itemId: 'a1', reason: 'rights', status: 'resolved' })], 'a1'),
    ).toBe(false);
  });

  it('only considers reports for the given item', () => {
    const reports = [
      report({ itemId: 'a1' }),
      report({ itemId: 'a2' }),
      report({ itemId: 'a2', reason: 'rights' }),
    ];
    expect(isItemHidden(reports, 'a1')).toBe(false);
    expect(isItemHidden(reports, 'a2')).toBe(true);
  });
});

describe('groupOpenReports', () => {
  it('groups open reports by item with counts, reasons and hidden flag', () => {
    const reports = [
      report({ id: 'r1', itemId: 'a1', reason: 'typo', comment: 'x', createdAt: 5 }),
      report({ id: 'r2', itemId: 'a1', reason: 'unclear', createdAt: 9 }),
      report({ id: 'r3', itemId: 'b2', reason: 'rights', createdAt: 2 }),
      report({ id: 'r4', itemId: 'c3', status: 'resolved' }),
    ];
    const groups = groupOpenReports(reports);
    expect(groups.map((g) => g.itemId)).toEqual(['a1', 'b2']);
    expect(groups[0]).toMatchObject({
      count: 2,
      reasons: { typo: 1, unclear: 1 },
      comments: ['x'],
      reportIds: ['r1', 'r2'],
      hidden: true,
      latestAt: 9,
    });
    expect(groups[1]).toMatchObject({ count: 1, hidden: true });
  });
});

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

describe('validateReportInput', () => {
  it('accepts a valid report and builds an open document', () => {
    const r = validateReportInput({ itemId: ' a1 ', reason: 'typo', comment: '  hi  ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ itemId: 'a1', reason: 'typo', comment: 'hi', status: 'open' });
    expect(typeof r.value.createdAt).toBe('number');
    expect(r.value).not.toHaveProperty('skillId');
  });

  it('rejects an empty or whitespace itemId', () => {
    expect(validateReportInput({ itemId: '  ', reason: 'typo' })).toEqual({
      ok: false,
      field: 'itemId',
    });
  });

  it('rejects an unknown reason', () => {
    const r = validateReportInput({ itemId: 'a1', reason: 'spam' as never });
    expect(r).toEqual({ ok: false, field: 'reason' });
  });

  it('accepts a comment of exactly the maximum length', () => {
    const r = validateReportInput({
      itemId: 'a1',
      reason: 'unclear',
      comment: 'x'.repeat(MAX_COMMENT_LENGTH),
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a comment one character over the maximum', () => {
    const r = validateReportInput({
      itemId: 'a1',
      reason: 'unclear',
      comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
    });
    expect(r).toEqual({ ok: false, field: 'comment' });
  });

  it('drops a whitespace-only comment instead of storing it', () => {
    const r = validateReportInput({ itemId: 'a1', reason: 'unclear', comment: '   ' });
    expect(r.ok && 'comment' in r.value).toBe(false);
  });

  it('rejects an overlong skillId', () => {
    const r = validateReportInput({ itemId: 'a1', skillId: 'y'.repeat(101), reason: 'typo' });
    expect(r).toEqual({ ok: false, field: 'skillId' });
  });
});

/* ------------------------------------------------------------------ */
/*  Submit with Firebase disabled (local queue)                        */
/* ------------------------------------------------------------------ */

describe('submitReport with Firebase disabled', () => {
  it('queues the report in localStorage without calling Firestore', async () => {
    const result = await submitReport({ itemId: 'a1', reason: 'typo', comment: 'oops' });
    expect(result).toBe('queued');
    expect(addDoc).not.toHaveBeenCalled();
    expect(getQueuedReportCount()).toBe(1);

    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    expect(stored[0].doc).toMatchObject({ itemId: 'a1', reason: 'typo', status: 'open' });
    // No personal data fields are ever stored.
    expect(Object.keys(stored[0].doc).sort()).toEqual(
      ['comment', 'createdAt', 'itemId', 'reason', 'status'].sort(),
    );
  });

  it('returns invalid and stores nothing for bad input', async () => {
    const result = await submitReport({ itemId: '', reason: 'typo' });
    expect(result).toBe('invalid');
    expect(getQueuedReportCount()).toBe(0);
  });

  it('caps the queue at MAX_QUEUE_SIZE, dropping the oldest', async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE + 5; i++) {
      await submitReport({ itemId: `item-${i}`, reason: 'unclear' });
    }
    expect(getQueuedReportCount()).toBe(MAX_QUEUE_SIZE);
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    expect(stored[0].doc.itemId).toBe('item-5');
  });

  it('flushQueuedReports sends nothing and keeps the queue', async () => {
    await submitReport({ itemId: 'a1', reason: 'typo' });
    expect(await flushQueuedReports()).toBe(0);
    expect(getQueuedReportCount()).toBe(1);
  });

  it('ignores corrupt or tampered localStorage data', async () => {
    localStorage.setItem(QUEUE_KEY, '{not json');
    expect(getQueuedReportCount()).toBe(0);

    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { queueId: 'ok', doc: { itemId: 'a1', reason: 'typo', createdAt: 1, status: 'open' } },
        { queueId: 'bad', doc: { itemId: 'a1', reason: 'hacked', createdAt: 1, status: 'open' } },
      ]),
    );
    expect(getQueuedReportCount()).toBe(1);
    expect(await submitReport({ itemId: 'a2', reason: 'rights' })).toBe('queued');
    expect(getQueuedReportCount()).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Submit and flush with Firebase enabled                             */
/* ------------------------------------------------------------------ */

describe('submitReport and flushQueuedReports with Firebase enabled', () => {
  beforeEach(() => {
    fb.enabled = true;
  });

  it('writes straight to Firestore when online', async () => {
    const result = await submitReport({ itemId: 'a1', reason: 'inappropriate' });
    expect(result).toBe('sent');
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(getQueuedReportCount()).toBe(0);
  });

  it('queues when the Firestore write fails', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    const result = await submitReport({ itemId: 'a1', reason: 'typo' });
    expect(result).toBe('queued');
    expect(getQueuedReportCount()).toBe(1);
  });

  it('flushQueuedReports sends queued reports and keeps the ones that still fail', async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { queueId: 'q1', doc: { itemId: 'a1', reason: 'typo', createdAt: 1, status: 'open' } },
        { queueId: 'q2', doc: { itemId: 'a2', reason: 'unclear', createdAt: 2, status: 'open' } },
      ]),
    );
    vi.mocked(addDoc)
      .mockResolvedValueOnce({ id: 'ok' } as never)
      .mockRejectedValueOnce(new Error('offline'));

    expect(await flushQueuedReports()).toBe(1);
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(getQueuedReportCount()).toBe(1);
    const left = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    expect(left[0].queueId).toBe('q2');
  });

  it('clears the queue after a full successful flush', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline')); // submit fails -> queued
    expect(await submitReport({ itemId: 'a1', reason: 'typo' })).toBe('queued');
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline')); // first flush fails
    expect(await flushQueuedReports()).toBe(0);
    expect(getQueuedReportCount()).toBe(1);

    expect(await flushQueuedReports()).toBe(1);
    expect(getQueuedReportCount()).toBe(0);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });
});
