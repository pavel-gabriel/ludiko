import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '@/services/firebase';
import type {
  TeacherProfile,
  ClassroomSession,
  SessionTemplate,
  StudentCode,
  StudentSessionResult,
  GameSettings,
  ClassroomMode,
  CustomQuestion,
} from '@/utils/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Recursively strip `undefined` values from an object.
 * Firestore rejects documents containing `undefined` fields.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/* ------------------------------------------------------------------ */
/*  Teacher profile                                                   */
/* ------------------------------------------------------------------ */

/** Create or update a teacher profile in Firestore */
export async function upsertTeacherProfile(profile: TeacherProfile): Promise<void> {
  if (!firebaseEnabled) return;
  await setDoc(doc(db, 'teachers', profile.uid), profile, { merge: true });
}

/** Delete a teacher profile (teachers/{uid}). Used by the in-app account deletion (F9). */
export async function deleteTeacherProfile(uid: string): Promise<void> {
  if (!firebaseEnabled) return;
  await deleteDoc(doc(db, 'teachers', uid));
}

/** Fetch a teacher profile by UID */
export async function getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
  if (!firebaseEnabled) return null;
  const snap = await getDoc(doc(db, 'teachers', uid));
  return snap.exists() ? (snap.data() as TeacherProfile) : null;
}

/* ------------------------------------------------------------------ */
/*  Classroom sessions                                                */
/* ------------------------------------------------------------------ */

/** Create a new classroom session */
export async function createSession(
  teacherUid: string,
  title: string,
  settings: GameSettings,
  classroomMode: ClassroomMode,
  globalTimer: number,
  studentCodes: StudentCode[],
): Promise<string> {
  if (!firebaseEnabled) return '';
  const session = stripUndefined({
    teacherUid,
    title,
    settings,
    classroomMode,
    globalTimer,
    studentCodes,
    status: 'draft' as const,
    createdAt: Date.now(),
  });
  const ref = await addDoc(collection(db, 'sessions'), session);
  await publishStudentCodes(ref.id, teacherUid, studentCodes);
  return ref.id;
}

/* ------------------------------------------------------------------ */
/*  Student-code index (sessionCodes): how a student's device validates a code            */
/* ------------------------------------------------------------------ */

/**
 * Students never read `sessions` (it holds the teacher's labels, which may be real names). To check the
 * code a student types, the device reads ONE document of this index by its exact key. It contains no label.
 */
export function studentCodeKey(sessionId: string, code: string): string {
  return `${sessionId}_${code.trim().toUpperCase()}`;
}

/** Make the index match `codes`: add the missing ones, remove the ones in `removeCodes` (idempotent) */
export async function publishStudentCodes(
  sessionId: string,
  teacherUid: string,
  codes: StudentCode[],
  removeCodes: StudentCode[] = [],
): Promise<void> {
  if (!firebaseEnabled || !sessionId) return;
  const batch = writeBatch(db);
  for (const { code } of codes) {
    batch.set(doc(db, 'sessionCodes', studentCodeKey(sessionId, code)), {
      sessionId,
      teacherUid,
      code: code.trim().toUpperCase(),
    });
  }
  const keep = new Set(codes.map((c) => c.code));
  for (const { code } of removeCodes) {
    if (!keep.has(code)) batch.delete(doc(db, 'sessionCodes', studentCodeKey(sessionId, code)));
  }
  await batch.commit();
}

/** True when `code` is one of the codes the teacher issued for this session (exact-key read) */
export async function isStudentCodeValid(sessionId: string, code: string): Promise<boolean> {
  if (!firebaseEnabled || !sessionId || !code.trim()) return false;
  const snap = await getDoc(doc(db, 'sessionCodes', studentCodeKey(sessionId, code)));
  return snap.exists();
}

/**
 * The teacher-assigned label of a student code ("Student 3" by default, edited by the teacher), looked up
 * in the teacher's own code list. Never the text a child typed: unknown codes get the code itself.
 */
export function labelForStudentCode(codes: StudentCode[], code: string): string {
  const wanted = code.trim().toUpperCase();
  return codes.find((c) => c.code.toUpperCase() === wanted)?.label ?? code;
}

/** Fetch all sessions for a teacher */
export async function getTeacherSessions(teacherUid: string): Promise<ClassroomSession[]> {
  if (!firebaseEnabled) return [];
  const q = query(
    collection(db, 'sessions'),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassroomSession));
}

/** Fetch a single session by ID */
export async function getSession(sessionId: string): Promise<ClassroomSession | null> {
  if (!firebaseEnabled) return null;
  const snap = await getDoc(doc(db, 'sessions', sessionId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ClassroomSession) : null;
}

/** Update session fields */
export async function updateSession(
  sessionId: string,
  updates: Partial<ClassroomSession>,
): Promise<void> {
  if (!firebaseEnabled) return;
  if (updates.studentCodes) {
    /* keep the student-code index in step with the list (the previous list says which codes to remove) */
    const before = await getSession(sessionId);
    if (before) await publishStudentCodes(sessionId, before.teacherUid, updates.studentCodes, before.studentCodes);
  }
  await updateDoc(doc(db, 'sessions', sessionId), stripUndefined(updates as Record<string, unknown>));
}

/** Delete a session */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!firebaseEnabled) return;
  const before = await getSession(sessionId);
  if (before) {
    const batch = writeBatch(db);
    for (const { code } of before.studentCodes ?? []) batch.delete(doc(db, 'sessionCodes', studentCodeKey(sessionId, code)));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'sessions', sessionId));
}

/* ------------------------------------------------------------------ */
/*  Student codes                                                     */
/* ------------------------------------------------------------------ */

const ANIMALS = [
  'LION', 'BEAR', 'WOLF', 'HAWK', 'DEER', 'DUCK', 'FROG', 'FISH',
  'PUMA', 'SEAL', 'LYNX', 'SWAN', 'HARE', 'DOVE', 'WASP', 'CRAB',
  'CROW', 'MOLE', 'NEWT', 'WREN', 'LARK', 'BULL', 'GOAT', 'LAMB',
  'MICE', 'PONY', 'FOAL', 'MOTH', 'TOAD', 'IBIS',
];

/** Generate unique student codes (e.g. LION-42, BEAR-87) */
export function generateStudentCodes(count: number): StudentCode[] {
  const used = new Set<string>();
  const codes: StudentCode[] = [];
  const animals = [...ANIMALS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    let code: string;
    do {
      const animal = animals[i % animals.length];
      const num = Math.floor(Math.random() * 90) + 10;
      code = `${animal}-${num}`;
    } while (used.has(code));
    used.add(code);
    codes.push({ code, label: `Student ${i + 1}` });
  }
  return codes;
}

/* ------------------------------------------------------------------ */
/*  Session results                                                   */
/* ------------------------------------------------------------------ */

/** Save results for a classroom session */
export async function saveSessionResults(
  sessionId: string,
  results: StudentSessionResult[],
): Promise<void> {
  if (!firebaseEnabled) return;
  await setDoc(doc(db, 'sessionResults', sessionId), { results, savedAt: Date.now() });
}

/** Delete the saved results of a session (they contain the names children typed). Used by F9 account deletion. */
export async function deleteSessionResults(sessionId: string): Promise<void> {
  if (!firebaseEnabled) return;
  await deleteDoc(doc(db, 'sessionResults', sessionId));
}

/** Fetch results for a classroom session */
export async function getSessionResults(
  sessionId: string,
): Promise<StudentSessionResult[]> {
  if (!firebaseEnabled) return [];
  const snap = await getDoc(doc(db, 'sessionResults', sessionId));
  if (!snap.exists()) return [];
  return (snap.data().results ?? []) as StudentSessionResult[];
}

/* ------------------------------------------------------------------ */
/*  Templates                                                         */
/* ------------------------------------------------------------------ */

/** Save a session template */
export async function saveTemplate(
  teacherUid: string,
  name: string,
  settings: GameSettings,
  classroomMode: ClassroomMode,
  globalTimer: number,
  customQuestions?: CustomQuestion[],
): Promise<string> {
  if (!firebaseEnabled) return '';
  const template = stripUndefined({
    teacherUid,
    name,
    settings,
    classroomMode,
    globalTimer,
    ...(customQuestions && customQuestions.length > 0 && { customQuestions }),
    createdAt: Date.now(),
  });
  const ref = await addDoc(collection(db, 'templates'), template);
  return ref.id;
}

/** Fetch all templates for a teacher */
export async function getTeacherTemplates(teacherUid: string): Promise<SessionTemplate[]> {
  if (!firebaseEnabled) return [];
  const q = query(
    collection(db, 'templates'),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SessionTemplate));
}

/** Delete a template */
export async function deleteTemplate(templateId: string): Promise<void> {
  if (!firebaseEnabled) return;
  await deleteDoc(doc(db, 'templates', templateId));
}

/* ------------------------------------------------------------------ */
/*  CSV export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Escape a CSV field: quote fields containing separators/quotes/newlines
 * and neutralize leading formula characters (=, +, -, @) so exported
 * files can't inject spreadsheet formulas.
 */
function csvEscape(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Generate CSV string from session results */
export function exportResultsToCSV(
  sessionTitle: string,
  results: StudentSessionResult[],
): string {
  const header = 'Student Code,Label,Score,Total Questions,Accuracy (%),Time (s)';
  const rows = results.map((r) =>
    [r.studentCode, r.studentLabel, r.score, r.totalQuestions, r.accuracy, r.timeTaken]
      .map(csvEscape)
      .join(','),
  );
  return [
    `# ${csvEscape(sessionTitle)}`,
    `# Exported ${new Date().toISOString()}`,
    '',
    header,
    ...rows,
  ].join('\n');
}

/** Trigger a CSV file download in the browser */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
