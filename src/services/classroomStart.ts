import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import { publishStudentCodes, updateSession } from '@/services/teacherService';
import type { ClassroomSession, Room } from '@/utils/types';

/**
 * Starts a draft classroom session: opens the RTDB room tagged with the session, links it to the Firestore
 * session (status `active`) and returns the room (the teacher's device keeps it in the room store).
 * Shared by the session page and the session wizard's "Pornește".
 */
export async function startClassroomSession(session: ClassroomSession, teacherName: string): Promise<Room> {
  await ensureAnonymousAuth();
  /* Make sure students' devices can validate their codes (also for sessions created before the index existed) */
  await publishStudentCodes(session.id, session.teacherUid, session.studentCodes);
  /* A special room for this classroom session */
  const room = buildRoom(teacherName, session.settings, '👩‍🏫');
  room.classroomSessionId = session.id;
  room.classroomMode = session.classroomMode;
  room.globalTimer = session.globalTimer;

  await createRoomInDB(room);
  registerDisconnectCleanup(room.id, true, undefined, room.code);

  /* Link the RTDB room to the Firestore session */
  await updateSession(session.id, { status: 'active', roomId: room.id });
  return room;
}
