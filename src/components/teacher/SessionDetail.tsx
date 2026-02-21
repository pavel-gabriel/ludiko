import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import {
  getSession,
  updateSession,
} from '@/services/teacherService';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import type { ClassroomSession } from '@/utils/types';

export default function SessionDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { uid } = useAuthStore();
  const { setRoom, setCurrentPlayer } = useRoomStore();
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !sessionId) { navigate('/teacher/login'); return; }
    getSession(sessionId).then((s) => {
      if (!s) { navigate('/teacher'); return; }
      setSession(s);
      setLoading(false);
    });
  }, [uid, sessionId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  const handleCopyAllCodes = () => {
    if (!session) return;
    const text = session.studentCodes.map((sc) => `${sc.code} — ${sc.label}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleStartSession = async () => {
    if (!session || !sessionId || starting) return;
    setStarting(true);
    try {
      await ensureAnonymousAuth();
      /* Create a special room for this classroom session */
      const room = buildRoom(t('teacher.teacher'), session.settings, '👩‍🏫');
      /* Tag the room as a classroom session */
      room.classroomSessionId = sessionId;
      room.classroomMode = session.classroomMode;
      room.globalTimer = session.globalTimer;

      await createRoomInDB(room);
      registerDisconnectCleanup(room.id, true);

      /* Link the RTDB room to the Firestore session */
      await updateSession(sessionId, { status: 'active', roomId: room.id });

      setRoom(room);
      setCurrentPlayer(room.players[0]);

      /* Navigate to the teacher live dashboard */
      navigate(`/teacher/live/${sessionId}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="page">
        <p className="text-gray-400">{t('teacher.loading')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-2 text-center">{session.title}</h2>
        <p className="text-sm text-center text-gray-500 mb-4">
          {t(`teacher.mode.${session.classroomMode}`)} &middot;{' '}
          {t(`create.gameType${session.settings.gameType.charAt(0).toUpperCase() + session.settings.gameType.slice(1)}`)}
        </p>

        {/* Room code for students */}
        {session.roomId && (
          <div className="text-center mb-4">
            <span className="text-sm text-gray-500">{t('lobby.roomCode')}</span>
            <p className="text-3xl font-extrabold tracking-widest text-ludiko-purple">
              {/* Room code is shown on live dashboard */}
              {t('teacher.sessionActive')}
            </p>
          </div>
        )}

        {/* Student codes */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-500">
              {t('teacher.studentCodes')} ({session.studentCodes.length})
            </h3>
            <button
              onClick={handleCopyAllCodes}
              className="text-xs text-ludiko-purple hover:underline font-bold"
            >
              {t('teacher.copyAll')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {session.studentCodes.map((sc) => (
              <button
                key={sc.code}
                onClick={() => handleCopyCode(sc.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                  copied === sc.code ? 'bg-ludiko-green/30' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="font-mono font-bold text-sm">{sc.code}</span>
                <span className="text-xs text-gray-400 truncate">{sc.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/teacher')}>
            {t('teacher.back')}
          </Button>
          <Button
            variant="blue"
            size="md"
            onClick={() => navigate(`/teacher/session/${sessionId}/edit`)}
          >
            {t('teacher.edit')}
          </Button>
          {session.status === 'draft' && (
            <Button
              variant="green"
              size="md"
              className="flex-1"
              onClick={handleStartSession}
              disabled={starting}
            >
              {starting ? t('teacher.starting') : t('teacher.startSession')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
