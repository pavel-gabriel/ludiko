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
  return ref.id;
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
  await updateDoc(doc(db, 'sessions', sessionId), stripUndefined(updates as Record<string, unknown>));
}

/** Delete a session */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!firebaseEnabled) return;
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

/** Generate CSV string from session results */
export function exportResultsToCSV(
  sessionTitle: string,
  results: StudentSessionResult[],
): string {
  const header = 'Student Code,Label,Score,Total Questions,Accuracy (%),Time (s)';
  const rows = results.map((r) =>
    `${r.studentCode},${r.studentLabel},${r.score},${r.totalQuestions},${r.accuracy},${r.timeTaken}`,
  );
  return [
    `# ${sessionTitle}`,
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
