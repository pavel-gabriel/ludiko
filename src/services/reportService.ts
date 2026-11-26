import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '@/services/firebase';
import { sanitizeSnapshot, type ReportSnapshot } from '@/services/reportSnapshot';

export type { ReportSnapshot } from '@/services/reportSnapshot';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

export const REPORTS_COLLECTION = 'contentReports';

export const REPORT_REASONS = [
  'wrong-answer',
  'unclear',
  'typo',
  'inappropriate',
  'rights',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Max length of the optional free-text comment (characters). */
export const MAX_COMMENT_LENGTH = 300;
/** Max length of itemId / skillId (characters). */
export const MAX_ID_LENGTH = 100;

/** An item with at least this many open reports is hidden automatically. */
export const AUTO_HIDE_REPORT_THRESHOLD = 2;
/** An item with at least this many open 'rights' reports is hidden immediately. */
export const RIGHTS_HIDE_THRESHOLD = 1;

/** Offline queue cap, so localStorage stays bounded. Oldest entries are dropped first. */
export const MAX_QUEUE_SIZE = 50;
const QUEUE_KEY = 'ludiko.contentReportQueue.v1';

export interface ContentReport {
  id: string;
  itemId: string;
  skillId?: string;
  reason: ReportReason;
  comment?: string;
  createdAt: number;
  status: ReportStatus;
  appVersion?: string;
  /** The question as the child saw it. Absent on old reports. */
  snapshot?: ReportSnapshot;
}

/** What the child submits. No personal data: no names, emails or profile ids. */
export interface ReportInput {
  itemId: string;
  skillId?: string;
  reason: ReportReason;
  comment?: string;
  snapshot?: ReportSnapshot;
}

/** The document written to Firestore (or queued locally). */
export interface NewReportDoc {
  itemId: string;
  skillId?: string;
  reason: ReportReason;
  comment?: string;
  createdAt: number;
  status: 'open';
  appVersion?: string;
  snapshot?: ReportSnapshot;
}

export type ReportValidationField = 'itemId' | 'skillId' | 'reason' | 'comment';

export type ReportValidation =
  | { ok: true; value: NewReportDoc }
  | { ok: false; field: ReportValidationField };

/**
 * Outcome of submitReport:
 * - 'sent'    written to Firestore
 * - 'queued'  saved in localStorage, flushed later by flushQueuedReports()
 * - 'invalid' input failed validation, nothing stored
 * - 'failed'  could not be stored anywhere (e.g. localStorage full)
 */
export type SubmitResult = 'sent' | 'queued' | 'invalid' | 'failed';

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value);
}

/** Validate and normalise a report. Pure; never throws. */
export function validateReportInput(input: ReportInput): ReportValidation {
  const itemId = typeof input.itemId === 'string' ? input.itemId.trim() : '';
  if (itemId.length === 0 || itemId.length > MAX_ID_LENGTH) {
    return { ok: false, field: 'itemId' };
  }

  if (!isReportReason(input.reason)) {
    return { ok: false, field: 'reason' };
  }

  const skillId =
    typeof input.skillId === 'string' ? input.skillId.trim() : '';
  if (skillId.length > MAX_ID_LENGTH) {
    return { ok: false, field: 'skillId' };
  }

  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { ok: false, field: 'comment' };
  }

  // A bad snapshot is dropped, it never blocks the report.
  const snapshot = input.snapshot === undefined ? undefined : sanitizeSnapshot(input.snapshot);

  const value: NewReportDoc = {
    itemId,
    reason: input.reason,
    createdAt: Date.now(),
    status: 'open',
    // Optional fields are omitted rather than set to undefined (Firestore rejects undefined).
    ...(skillId ? { skillId } : {}),
    ...(comment ? { comment } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(readAppVersion() ? { appVersion: readAppVersion() } : {}),
  };
  return { ok: true, value };
}

function readAppVersion(): string | undefined {
  const v = import.meta.env.VITE_APP_VERSION as string | undefined;
  return typeof v === 'string' && v.length > 0 && v.length <= 20 ? v : undefined;
}

/* ------------------------------------------------------------------ */
/*  Offline queue (localStorage, every access guarded)                 */
/* ------------------------------------------------------------------ */

interface QueuedReport {
  queueId: string;
  doc: NewReportDoc;
}

function newQueueId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readQueue(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: QueuedReport[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const { queueId, doc: stored } = entry as { queueId?: unknown; doc?: unknown };
      if (typeof queueId !== 'string' || !stored || typeof stored !== 'object') continue;
      // Re-validate stored data: localStorage is editable by anyone on the device.
      const check = validateReportInput(stored as ReportInput);
      if (check.ok) out.push({ queueId, doc: check.value });
    }
    return out;
  } catch {
    return [];
  }
}

function writeQueue(entries: QueuedReport[]): boolean {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
    }
    return true;
  } catch {
    return false;
  }
}

/** Number of reports waiting in the local queue. */
export function getQueuedReportCount(): number {
  return readQueue().length;
}

function enqueue(value: NewReportDoc): boolean {
  const current = readQueue();
  current.push({ queueId: newQueueId(), doc: value });
  const capped = current.slice(-MAX_QUEUE_SIZE);
  return writeQueue(capped);
}

/* ------------------------------------------------------------------ */
/*  Submit & flush                                                     */
/* ------------------------------------------------------------------ */

/**
 * Store a report. Writes to Firestore when Firebase is enabled and the device
 * is online; otherwise (or if the write fails) queues it in localStorage.
 */
export async function submitReport(input: ReportInput): Promise<SubmitResult> {
  const check = validateReportInput(input);
  if (!check.ok) return 'invalid';

  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (firebaseEnabled && online) {
    try {
      await addDoc(collection(db, REPORTS_COLLECTION), check.value);
      return 'sent';
    } catch {
      // Fall through to the local queue (network error, auth not ready, rules).
    }
  }

  return enqueue(check.value) ? 'queued' : 'failed';
}

/**
 * Try to send queued reports. Returns the number sent. Reports that still
 * fail stay in the queue for the next attempt.
 */
export async function flushQueuedReports(): Promise<number> {
  if (!firebaseEnabled) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const remaining: QueuedReport[] = [];
  for (let i = 0; i < queue.length; i++) {
    try {
      await addDoc(collection(db, REPORTS_COLLECTION), queue[i].doc);
      sent++;
    } catch {
      // Keep this and everything after it; stop early, likely offline.
      remaining.push(...queue.slice(i));
      break;
    }
  }
  writeQueue(remaining);
  return sent;
}

/* ------------------------------------------------------------------ */
/*  Hiding rule (pure)                                                 */
/* ------------------------------------------------------------------ */

/**
 * An item is hidden when it has at least AUTO_HIDE_REPORT_THRESHOLD open
 * reports, or at least RIGHTS_HIDE_THRESHOLD open 'rights' reports.
 * Resolved and dismissed reports do not count.
 */
export function isItemHidden(reports: ContentReport[], itemId: string): boolean {
  let open = 0;
  let rights = 0;
  for (const r of reports) {
    if (r.itemId !== itemId || r.status !== 'open') continue;
    open++;
    if (r.reason === 'rights') rights++;
  }
  return rights >= RIGHTS_HIDE_THRESHOLD || open >= AUTO_HIDE_REPORT_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/*  Admin grouping (pure)                                              */
/* ------------------------------------------------------------------ */

export interface ReportGroup {
  itemId: string;
  count: number;
  reasons: Partial<Record<ReportReason, number>>;
  comments: string[];
  reportIds: string[];
  hidden: boolean;
  latestAt: number;
  skillId?: string;
  snapshot?: ReportSnapshot;
}

/** Group open reports by item, most-reported first. Pure. */
export function groupOpenReports(reports: ContentReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const r of reports) {
    if (r.status !== 'open') continue;
    let g = groups.get(r.itemId);
    if (!g) {
      g = {
        itemId: r.itemId,
        count: 0,
        reasons: {},
        comments: [],
        reportIds: [],
        hidden: false,
        latestAt: 0,
      };
      groups.set(r.itemId, g);
    }
    g.count++;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.comment) g.comments.push(r.comment);
    g.reportIds.push(r.id);
    g.latestAt = Math.max(g.latestAt, r.createdAt);
    if (!g.skillId && r.skillId) g.skillId = r.skillId;
    if (!g.snapshot && r.snapshot) g.snapshot = r.snapshot;
  }
  const list = [...groups.values()];
  for (const g of list) g.hidden = isItemHidden(reports, g.itemId);
  return list.sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
}

/* ------------------------------------------------------------------ */
/*  Admin helpers (Firestore)                                          */
/* ------------------------------------------------------------------ */

function toReport(id: string, data: DocumentData): ContentReport | null {
  const check = validateReportInput(data as ReportInput);
  if (!check.ok) return null;
  const status = (REPORT_STATUSES as readonly string[]).includes(data.status)
    ? (data.status as ReportStatus)
    : null;
  if (!status) return null;
  return {
    id,
    ...check.value,
    status,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  };
}

/** List reports, optionally filtered by status. Newest first. Returns [] when Firebase is off. */
export async function listReports(status?: ReportStatus): Promise<ContentReport[]> {
  if (!firebaseEnabled) return [];
  const ref = collection(db, REPORTS_COLLECTION);
  // Single-field where needs no composite index; sorting happens client-side.
  const snap = await getDocs(status ? query(ref, where('status', '==', status)) : query(ref));
  const out: ContentReport[] = [];
  for (const d of snap.docs) {
    const r = toReport(d.id, d.data());
    if (r) out.push(r);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Mark a report resolved or dismissed. Throws when Firebase is off. */
export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  if (!firebaseEnabled) throw new Error('Firebase is not enabled');
  await updateDoc(doc(db, REPORTS_COLLECTION, id), { status });
}
