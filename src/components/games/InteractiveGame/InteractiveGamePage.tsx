import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { useAuthStore } from '@/store/authStore';
import { generateQuestion } from '@/services/gameEngine';
import {
  initGameState,
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { deleteRoom } from '@/services/roomManager';
import type { Question } from '@/utils/types';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import GameResults from '@/components/leaderboard/GameResults';
import InteractiveQuestionPanel from './InteractiveQuestionPanel';
import RaceTrack from '@/components/games/MathRace/RaceTrack';

export default function InteractiveGamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset } = useRoomStore();
  const { uid } = useAuthStore();

  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showCountdown, setShowCountdown] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Each player tracks their own question index locally */
  const [localIndex1, setLocalIndex1] = useState(0);
  const [localIndex2, setLocalIndex2] = useState(0);
  const finished1Ref = useRef(false);
  const finished2Ref = useRef(false);

  const settings = room?.settings;
  const displayTotal = settings?.rounds ?? 10;

  const player1 = room?.players[0];
  const player2 = room?.players[1];

  const handleExit = useCallback(() => {
    if (room) deleteRoom(room.id);
    reset();
    navigate(uid ? '/teacher' : '/');
  }, [reset, navigate, room, uid]);

  /* Intercept browser back button */
  useEffect(() => {
    const onPopState = () => { handleExit(); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleExit]);

  /* Host generates questions */
  useEffect(() => {
    if (!room || !settings) return;
    const questions: Question[] = [];
    for (let i = 0; i < displayTotal; i++) {
      questions.push(generateQuestion(settings.difficulty, settings.operations));
    }
    const playerIds = room.players.map((p) => p.id);
    initGameState(room.id, questions, playerIds);
  }, [room?.id]);

  /* Subscribe to game state */
  useEffect(() => {
    if (!room) return;
    const unsubscribe = listenToGameState(room.id, setGameState);
    return () => unsubscribe();
  }, [room?.id]);

  /* Countdown */
  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setShowCountdown(false);
          if (room) setGamePhase(room.id, 'playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdown, room?.id]);

  /* Per-question timer (Race mode only) — use the faster player's index */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    const minIndex = Math.min(localIndex1, localIndex2);
    if (minIndex >= displayTotal) return;

    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          /* Auto-skip for both players when time expires */
          setLocalIndex1((i) => (i < displayTotal ? i + 1 : i));
          setLocalIndex2((i) => (i < displayTotal ? i + 1 : i));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [Math.min(localIndex1, localIndex2), gameState?.phase]);

  /* Check finish for player 1 */
  useEffect(() => {
    if (!room || !player1 || !gameState || gameState.phase !== 'playing') return;
    if (localIndex1 >= displayTotal && !finished1Ref.current) {
      finished1Ref.current = true;
      recordPlayerFinished(room.id, player1.id);
    }
  }, [localIndex1]);

  /* Check finish for player 2 */
  useEffect(() => {
    if (!room || !player2 || !gameState || gameState.phase !== 'playing') return;
    if (localIndex2 >= displayTotal && !finished2Ref.current) {
      finished2Ref.current = true;
      recordPlayerFinished(room.id, player2.id);
    }
  }, [localIndex2]);

  /* Both finished -> end game */
  useEffect(() => {
    if (!room || !gameState || gameState.phase !== 'playing') return;
    if (finished1Ref.current && finished2Ref.current) {
      setGamePhase(room.id, 'finished');
    }
    /* Also end if either finishes (race to finish behavior) */
    if (finished1Ref.current || finished2Ref.current) {
      setGamePhase(room.id, 'finished');
    }
  }, [localIndex1, localIndex2, gameState?.phase]);

  /* Handle answers */
  const handleAnswer1 = useCallback(
    async (answer: number) => {
      if (!gameState || !room || !player1) return;
      const currentQ = gameState.questions?.[localIndex1];
      if (!currentQ) return;
      if (answer === currentQ.correctAnswer) {
        const newCount = (gameState.progress[player1.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, player1.id, newCount);
      }
      setLocalIndex1((prev) => prev + 1);
    },
    [gameState, room, player1, localIndex1],
  );

  const handleAnswer2 = useCallback(
    async (answer: number) => {
      if (!gameState || !room || !player2) return;
      const currentQ = gameState.questions?.[localIndex2];
      if (!currentQ) return;
      if (answer === currentQ.correctAnswer) {
        const newCount = (gameState.progress[player2.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, player2.id, newCount);
      }
      setLocalIndex2((prev) => prev + 1);
    },
    [gameState, room, player2, localIndex2],
  );

  /* Navigation guards */
  if (!room || !currentPlayer || !player1 || !player2) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  const handleReplay = useCallback(async () => {
    if (!room || !settings) return;
    setLocalIndex1(0);
    setLocalIndex2(0);
    finished1Ref.current = false;
    finished2Ref.current = false;
    setShowCountdown(true);
    setCountdown(COUNTDOWN_SECONDS);
    const questions: Question[] = [];
    for (let i = 0; i < displayTotal; i++) {
      questions.push(generateQuestion(settings.difficulty, settings.operations));
    }
    await initGameState(room.id, questions, room.players.map((p) => p.id));
  }, [room, settings, displayTotal]);

  if (gameState?.phase === 'finished') {
    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={displayTotal}
        finishTimes={gameState.finishTimes}
        gameMode="raceToFinish"
        startedAt={gameState.startedAt}
        onPlayAgain={handleReplay}
        onNewGame={() => { if (room) deleteRoom(room.id); reset(); navigate(uid ? '/teacher' : '/'); }}
      />
    );
  }

  if (!gameState || !gameState.questions?.length) {
    return (
      <div className="page">
        <p className="text-lg text-gray-500">{t('game.getReady')}</p>
      </div>
    );
  }

  const question1 = gameState.questions[localIndex1];
  const question2 = gameState.questions[localIndex2];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 flex flex-col" role="main">
      {/* Exit button */}
      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={handleExit}
          aria-label={t('game.exitGame')}
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Race track (shared) */}
      <div className="px-4 py-2">
        <RaceTrack
          players={room.players}
          progress={gameState.progress}
          totalQuestions={displayTotal}
        />
      </div>

      {/* Split screen — two game panels side by side */}
      <div className="flex flex-1 gap-1 px-1 pb-2 min-h-0">
        {/* Player 1 panel */}
        <div className="flex-1 flex flex-col min-w-0" role="region" aria-label={player1.name}>
          <div className="text-center py-1">
            <span className="text-lg" aria-hidden="true">{player1.avatar}</span>
            <span className="text-xs font-bold ml-1 truncate">{player1.name}</span>
          </div>
          {localIndex1 < displayTotal && question1 ? (
            <InteractiveQuestionPanel
              key={`p1-${localIndex1}`}
              question={question1}
              questionNumber={localIndex1 + 1}
              totalQuestions={displayTotal}
              timeRemaining={timeRemaining}
              onAnswer={handleAnswer1}
              colorAccent="blue"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-0.5 bg-gray-300 self-stretch my-2 rounded-full" />

        {/* Player 2 panel */}
        <div className="flex-1 flex flex-col min-w-0" role="region" aria-label={player2.name}>
          <div className="text-center py-1">
            <span className="text-lg" aria-hidden="true">{player2.avatar}</span>
            <span className="text-xs font-bold ml-1 truncate">{player2.name}</span>
          </div>
          {localIndex2 < displayTotal && question2 ? (
            <InteractiveQuestionPanel
              key={`p2-${localIndex2}`}
              question={question2}
              questionNumber={localIndex2 + 1}
              totalQuestions={displayTotal}
              timeRemaining={timeRemaining}
              onAnswer={handleAnswer2}
              colorAccent="pink"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
