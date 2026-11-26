/**
 * In-app teacher account deletion (F9, docs/PRIVACY_DATA_MAP.md). Pure orchestration: every Firebase call
 * is injected, so the order and the failure rules can be tested without Firebase.
 *
 * Order and rules:
 *  1. Re-confirm the teacher first. A wrong password deletes nothing.
 *  2. Delete the data the teacher owns: classes (with seats, progress, assignments, join codes),
 *     sessions (with their results), templates.
 *  3. Only if every data step succeeded: delete the teacher profile (teachers/{uid}), then the Auth user.
 *     If any step failed, the account is kept so the teacher can retry; nothing is left half-orphaned
 *     without the sign-in that could delete it later.
 */

export type DeletionStep = 'classes' | 'sessions' | 'templates' | 'profile' | 'account';

export interface TeacherDeletionDeps {
  /** Throws when the teacher cannot be re-confirmed (wrong password, popup closed, not signed in). */
  reauthenticate: () => Promise<void>;
  listClasses: (uid: string) => Promise<Array<{ id: string }>>;
  deleteClass: (classId: string) => Promise<void>;
  listSessions: (uid: string) => Promise<Array<{ id: string }>>;
  deleteSessionResults: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  listTemplates: (uid: string) => Promise<Array<{ id: string }>>;
  deleteTemplate: (templateId: string) => Promise<void>;
  deleteProfile: (uid: string) => Promise<void>;
  deleteAuthUser: () => Promise<void>;
}

export type TeacherDeletionOutcome =
  | { status: 'deleted' }
  | { status: 'reauth-failed' }
  | { status: 'partial'; failed: DeletionStep[] };

/** Runs `fn` for each id, keeping going after failures. Returns true only if all succeeded. */
async function eachId(ids: string[], fn: (id: string) => Promise<void>): Promise<boolean> {
  let allOk = true;
  for (const id of ids) {
    try {
      await fn(id);
    } catch {
      allOk = false;
    }
  }
  return allOk;
}

export async function deleteTeacherAccount(uid: string, deps: TeacherDeletionDeps): Promise<TeacherDeletionOutcome> {
  try {
    await deps.reauthenticate();
  } catch {
    return { status: 'reauth-failed' };
  }

  const failed = new Set<DeletionStep>();

  const run = async (step: DeletionStep, work: () => Promise<boolean>) => {
    try {
      if (!(await work())) failed.add(step);
    } catch {
      failed.add(step);
    }
  };

  await run('classes', async () => {
    const classes = await deps.listClasses(uid);
    return eachId(
      classes.map((c) => c.id),
      (id) => deps.deleteClass(id),
    );
  });

  await run('sessions', async () => {
    const sessions = await deps.listSessions(uid);
    // Results first: if they cannot be removed, the session stays so the teacher can retry.
    return eachId(sessions.map((s) => s.id), async (id) => {
      await deps.deleteSessionResults(id);
      await deps.deleteSession(id);
    });
  });

  await run('templates', async () => {
    const templates = await deps.listTemplates(uid);
    return eachId(
      templates.map((t) => t.id),
      (id) => deps.deleteTemplate(id),
    );
  });

  if (failed.size > 0) return { status: 'partial', failed: [...failed] };

  await run('profile', async () => {
    await deps.deleteProfile(uid);
    return true;
  });
  if (failed.size > 0) return { status: 'partial', failed: [...failed] };

  await run('account', async () => {
    await deps.deleteAuthUser();
    return true;
  });
  if (failed.size > 0) return { status: 'partial', failed: [...failed] };

  return { status: 'deleted' };
}
