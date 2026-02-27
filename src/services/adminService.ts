import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/services/firebase';
import type { ClassroomSession, StudentSessionResult } from '@/utils/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AdminStats {
  /** Total registered teachers */
  totalTeachers: number;
  /** Total classroom sessions ever created */
  totalSessions: number;
  /** Sessions currently active */
  activeSessions: number;
  /** Sessions completed */
  finishedSessions: number;
  /** Sessions in draft state */
  draftSessions: number;
  /** Total student result records across all sessions */
  totalStudentResults: number;
  /** Breakdown of sessions by game type */
  sessionsByGameType: Record<string, number>;
  /** 5 most recently created sessions */
  recentSessions: RecentSessionRow[];
}

export interface RecentSessionRow {
  id: string;
  title: string;
  teacherUid: string;
  status: string;
  gameType: string;
  studentCount: number;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/*  Admin PIN guard                                                    */
/* ------------------------------------------------------------------ */

/**
 * Verify a PIN against the env var VITE_ADMIN_PIN.
 * Falls back to "admin" when the var is not set (dev only).
 */
export function verifyAdminPin(pin: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PIN ?? 'admin';
  return pin === expected;
}

/* ------------------------------------------------------------------ */
/*  Aggregate stats                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch aggregate platform statistics for the admin dashboard.
 * All queries run in parallel for speed.
 */
export async function getAdminStats(): Promise<AdminStats> {
  if (!firebaseEnabled) {
    return {
      totalTeachers: 0,
      totalSessions: 0,
      activeSessions: 0,
      finishedSessions: 0,
      draftSessions: 0,
      totalStudentResults: 0,
      sessionsByGameType: {},
      recentSessions: [],
    };
  }

  /* Run three top-level queries in parallel */
  const [teachersSnap, sessionsSnap, resultsSnap] = await Promise.all([
    getDocs(collection(db, 'teachers')),
    getDocs(collection(db, 'sessions')),
    getDocs(collection(db, 'sessionResults')),
  ]);

  const sessions = sessionsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ClassroomSession),
  );

  /* Count sessions by status */
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const finishedSessions = sessions.filter((s) => s.status === 'finished').length;
  const draftSessions = sessions.filter((s) => s.status === 'draft').length;

  /* Count sessions by game type */
  const sessionsByGameType: Record<string, number> = {};
  for (const s of sessions) {
    const gt = s.settings?.gameType ?? 'unknown';
    sessionsByGameType[gt] = (sessionsByGameType[gt] ?? 0) + 1;
  }

  /* Count total student result entries across all result docs */
  let totalStudentResults = 0;
  for (const d of resultsSnap.docs) {
    const results = (d.data().results ?? []) as StudentSessionResult[];
    totalStudentResults += results.length;
  }

  /* 5 most recent sessions */
  const recentSnap = await getDocs(
    query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(5)),
  );
  const recentSessions: RecentSessionRow[] = recentSnap.docs.map((d) => {
    const s = d.data() as ClassroomSession;
    return {
      id: d.id,
      title: s.title,
      teacherUid: s.teacherUid,
      status: s.status,
      gameType: s.settings?.gameType ?? 'unknown',
      studentCount: s.studentCodes?.length ?? 0,
      createdAt: s.createdAt,
    };
  });

  return {
    totalTeachers: teachersSnap.size,
    totalSessions: sessions.length,
    activeSessions,
    finishedSessions,
    draftSessions,
    totalStudentResults,
    sessionsByGameType,
    recentSessions,
  };
}
