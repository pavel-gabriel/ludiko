import { describe, it, expect, vi } from 'vitest';
import { deleteTeacherAccount, type TeacherDeletionDeps } from '@/services/teacherAccountDeletion';

// F9: teacher account deletion orchestration. Every Firebase call is a mock; the rules are tested here.

const UID = 'teacher-1';

function mockDeps(overrides: Partial<Record<keyof TeacherDeletionDeps, unknown>> = {}) {
  const calls: string[] = [];
  const rec = (name: string, impl: (...a: any[]) => any = async () => {}) =>
    vi.fn(async (...args: unknown[]) => {
      calls.push(`${name}:${args.join(',')}`);
      return impl(...args);
    });
  const deps = {
    reauthenticate: rec('reauthenticate'),
    listClasses: rec('listClasses', async () => [{ id: 'c1' }, { id: 'c2' }]),
    deleteClass: rec('deleteClass'),
    listSessions: rec('listSessions', async () => [{ id: 's1' }]),
    deleteSessionResults: rec('deleteSessionResults'),
    deleteSession: rec('deleteSession'),
    listTemplates: rec('listTemplates', async () => [{ id: 't1' }]),
    deleteTemplate: rec('deleteTemplate'),
    deleteProfile: rec('deleteProfile'),
    deleteAuthUser: rec('deleteAuthUser'),
    ...overrides,
  } as unknown as TeacherDeletionDeps;
  return { deps, calls };
}

describe('deleteTeacherAccount (F9)', () => {
  it('re-confirms first, deletes all owned data, then the profile, then the Auth user, in that order', async () => {
    const { deps, calls } = mockDeps();
    const outcome = await deleteTeacherAccount(UID, deps);

    expect(outcome).toEqual({ status: 'deleted' });
    expect(calls).toEqual([
      'reauthenticate:',
      `listClasses:${UID}`,
      'deleteClass:c1',
      'deleteClass:c2',
      `listSessions:${UID}`,
      'deleteSessionResults:s1',
      'deleteSession:s1',
      `listTemplates:${UID}`,
      'deleteTemplate:t1',
      `deleteProfile:${UID}`,
      'deleteAuthUser:',
    ]);
  });

  it('deletes nothing when the teacher cannot be re-confirmed', async () => {
    const { deps, calls } = mockDeps({
      reauthenticate: vi.fn(async () => {
        throw new Error('auth/invalid-credential');
      }),
    });
    const outcome = await deleteTeacherAccount(UID, deps);
    expect(outcome).toEqual({ status: 'reauth-failed' });
    expect(calls).toEqual([]);
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('keeps going after one class fails, reports the step, and keeps the account for a retry', async () => {
    const deleteClass = vi.fn(async (id: string) => {
      if (id === 'c1') throw new Error('permission-denied');
    });
    const { deps } = mockDeps({ deleteClass });
    const outcome = await deleteTeacherAccount(UID, deps);

    expect(outcome).toEqual({ status: 'partial', failed: ['classes'] });
    expect(deleteClass).toHaveBeenCalledTimes(2); // c2 still attempted
    expect(deps.deleteTemplate).toHaveBeenCalledWith('t1'); // other categories still run
    expect(deps.deleteProfile).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('keeps a session when its results cannot be removed (so it can be retried)', async () => {
    const { deps } = mockDeps({
      deleteSessionResults: vi.fn(async () => {
        throw new Error('network');
      }),
    });
    const outcome = await deleteTeacherAccount(UID, deps);
    expect(outcome).toEqual({ status: 'partial', failed: ['sessions'] });
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('reports a failed listing as that step without deleting anything else from it', async () => {
    const { deps } = mockDeps({
      listClasses: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const outcome = await deleteTeacherAccount(UID, deps);
    expect(outcome).toEqual({ status: 'partial', failed: ['classes'] });
    expect(deps.deleteClass).not.toHaveBeenCalled();
    expect(deps.deleteSession).toHaveBeenCalledWith('s1');
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('keeps the Auth user when the profile document cannot be deleted', async () => {
    const { deps } = mockDeps({
      deleteProfile: vi.fn(async () => {
        throw new Error('permission-denied');
      }),
    });
    const outcome = await deleteTeacherAccount(UID, deps);
    expect(outcome).toEqual({ status: 'partial', failed: ['profile'] });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('reports the account step when Auth deletion fails after the data is gone', async () => {
    const { deps } = mockDeps({
      deleteAuthUser: vi.fn(async () => {
        throw new Error('auth/requires-recent-login');
      }),
    });
    const outcome = await deleteTeacherAccount(UID, deps);
    expect(outcome).toEqual({ status: 'partial', failed: ['account'] });
    expect(deps.deleteProfile).toHaveBeenCalledWith(UID);
  });

  it('succeeds with nothing to delete (a teacher with no classes, sessions or templates)', async () => {
    const { deps } = mockDeps({
      listClasses: async () => [],
      listSessions: async () => [],
      listTemplates: async () => [],
    });
    expect(await deleteTeacherAccount(UID, deps)).toEqual({ status: 'deleted' });
    expect(deps.deleteAuthUser).toHaveBeenCalledTimes(1);
  });
});
