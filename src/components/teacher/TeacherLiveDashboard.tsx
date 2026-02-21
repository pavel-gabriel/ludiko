import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import {
  getSession,
  updateSession,
  saveSessionResults,
  exportResultsToCSV,
  downloadCSV,
} from '@/services/teacherService';
import { listenToRoom } from '@/services/roomManager';
import { listenToGameState, setGamePhase, advanceQuestion } from '@/services/gameSession';
import type { RTDBGameState } from '@/services/gameSession';
import type { ClassroomSession, Room, StudentSessionResult } from '@/utils/types';

export default function TeacherLiveDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { uid } = useAuthStore();
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  /* Load session */
  useEffect(() => {
    if (!uid || !sessionId) { navigate('/teacher/login'); return; }
    getSession(sessionId).then((s) => {
      if (!s) { navigate('/teacher'); return; }
      setSession(s);
    });
  }, [uid, sessionId]);

  /* Subscribe to RTDB room */
  useEffect(() => {
    if (!session?.roomId) return;
    const unsub = listenToRoom(session.roomId, setRoom);
    return () => unsub();
  }, [session?.roomId]);

  /* Subscribe to game state */
  useEffect(() => {
    if (!session?.roomId) return;
    const unsub = listenToGameState(session.roomId, setGameState);
    return () => unsub();
  }, [session?.roomId]);

  /* Global timer countdown */
  useEffect(() => {
    if (!session || !gameState || gameState.phase !== 'playing' || !gameState.startedAt) return;
    if (session.globalTimer <= 0) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - gameState.startedAt!) / 1000);
      const remaining = Math.max(0, session.globalTimer - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && session.roomId) {
        setGamePhase(session.roomId, 'finished');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, gameState?.phase, gameState?.startedAt]);

  /* Teacher-controlled: advance to next question */
  const handleNextQuestion = useCallback(async () => {
    if (!session?.roomId || !gameState) return;
    await advanceQuestion(session.roomId, gameState.currentIndex + 1);
  }, [session?.roomId, gameState?.currentIndex]);

  /* End session early */
  const handleEndSession = async () => {
    if (!session?.roomId || !sessionId) return;
    await setGamePhase(session.roomId, 'finished');
    await updateSession(sessionId, { status: 'finished' });
  };

  /* Export results as CSV */
  const handleExport = () => {
    if (!session || !room || !gameState) return;
    const results: StudentSessionResult[] = room.players
      .filter((p) => !p.isHost)
      .map((player) => ({
        studentCode: player.name,
        studentLabel: player.name,
        score: gameState.progress[player.id] ?? 0,
        totalQuestions: gameState.questions?.length ?? gameState.shapeQuestions?.length ?? 0,
        accuracy: 0,
        timeTaken: 0,
        answers: [],
      }));

    results.forEach((r) => {
      r.accuracy = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
    });

    /* Save to Firestore */
    saveSessionResults(sessionId!, results);

    /* Download CSV */
    const csv = exportResultsToCSV(session.title, results);
    downloadCSV(`${session.title.replace(/\s+/g, '_')}_results.csv`, csv);
  };

  if (!session) {
    return (
      <div className="page">
        <p className="text-gray-400">{t('teacher.loading')}</p>
      </div>
    );
  }

  const totalQuestions = gameState?.questions?.length
    ?? gameState?.shapeQuestions?.length
    ?? gameState?.memoryCards?.length
    ?? 0;
  const students = room?.players.filter((p) => !p.isHost) ?? [];
  const isTeacherControlled = session.classroomMode === 'teacherControlled';
  const isPlaying = gameState?.phase === 'playing';
  const isFinished = gameState?.phase === 'finished';

  return (
    <div className="page">
      <div className="card w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{session.title}</h2>
            <p className="text-sm text-gray-500">
              {t(`teacher.mode.${session.classroomMode}`)}
              {timeLeft != null && isPlaying && (
                <span className="ml-2 font-bold text-ludiko-purple">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              )}
            </p>
          </div>
          {room && (
            <div className="text-center">
              <span className="text-xs text-gray-500">{t('lobby.roomCode')}</span>
              <p className="text-2xl font-extrabold tracking-widest text-ludiko-purple">
                {room.code}
              </p>
            </div>
          )}
        </div>

        {/* Current question indicator (teacher-controlled) */}
        {isTeacherControlled && gameState && isPlaying && (
          <div className="flex items-center justify-between bg-ludiko-blue/10 rounded-xl px-4 py-3 mb-4">
            <span className="font-bold">
              {t('game.question')} {gameState.currentIndex + 1} / {totalQuestions}
            </span>
            <Button
              variant="blue"
              size="sm"
              onClick={handleNextQuestion}
              disabled={gameState.currentIndex >= totalQuestions - 1}
            >
              {t('teacher.nextQuestion')}
            </Button>
          </div>
        )}

        {/* Student progress table */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            {t('teacher.studentProgress')} ({students.length})
          </h3>
          {students.length === 0 ? (
            <p className="text-center text-gray-400 py-4">
              {t('teacher.waitingForStudents')}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {students
                .sort((a, b) => (gameState?.progress[b.id] ?? 0) - (gameState?.progress[a.id] ?? 0))
                .map((student) => {
                  const score = gameState?.progress[student.id] ?? 0;
                  const pct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
                  const finished = gameState?.finishTimes?.[student.id];
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2"
                    >
                      <span className="text-xl">{student.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{student.name}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              finished ? 'bg-ludiko-green' : 'bg-ludiko-blue'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-600">
                        {score}/{totalQuestions}
                      </span>
                      {finished && (
                        <span className="text-xs bg-ludiko-green px-2 py-1 rounded-lg font-bold text-green-800">
                          {t('teacher.done')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/teacher')}>
            {t('teacher.back')}
          </Button>
          {isPlaying && (
            <Button variant="pink" size="md" onClick={handleEndSession}>
              {t('teacher.endSession')}
            </Button>
          )}
          {isFinished && (
            <Button variant="green" size="md" className="flex-1" onClick={handleExport}>
              {t('teacher.exportCSV')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
