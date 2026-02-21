import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { generateQuestion } from '@/services/gameEngine';
import {
  initGameState,
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { replayRoom, deleteRoom, listenToRoom } from '@/services/roomManager';
import type { Question } from '@/utils/types';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import RaceTrack from './RaceTrack';
import QuestionCard from './QuestionCard';
import CountdownOverlay from './CountdownOverlay';
import GameResults from '@/components/leaderboard/GameResults';

/** Large question pool for Timed Sprint so players don't run out */
const SPRINT_POOL_SIZE = 100;

export default function MathRacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset } = useRoomStore();

  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showCountdown, setShowCountdown] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  /* Each player tracks their own question index locally */
  const [localIndex, setLocalIndex] = useState(0);

  const isHost = currentPlayer?.isHost ?? false;
  const settings = room?.settings;
  const isSprint = settings?.gameMode === 'timedSprint';

  /* For display and scoring in Race mode */
  const displayTotal = settings?.rounds ?? 10;

  const handleExit = useCallback(() => {
    if (isHost && room) deleteRoom(room.id);
    reset();
    navigate('/');
  }, [reset, navigate, isHost, room]);

  /* Intercept browser back button — exit cleanly instead of re-mounting */
  useEffect(() => {
    const onPopState = () => { handleExit(); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleExit]);

  /* Listen for room deletion (host left) — non-host players exit */
  useEffect(() => {
    if (!room) return;
    const unsub = listenToRoom(room.id, (r) => {
      if (!r) { reset(); navigate('/'); }
    });
    return () => unsub();
  }, [room?.id]);

  /* ----- STEP 1: Host generates questions and pushes game state ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;

    const count = isSprint ? SPRINT_POOL_SIZE : displayTotal;
    const questions: Question[] = [];
    for (let i = 0; i < count; i++) {
      questions.push(generateQuestion(settings.difficulty, settings.operations));
    }

    const playerIds = room.players.map((p) => p.id);
    initGameState(room.id, questions, playerIds);
  }, [room?.id, isHost]);

  /* ----- STEP 2: Subscribe to game state from RTDB ----- */
  useEffect(() => {
    if (!room) return;
    const unsubscribe = listenToGameState(room.id, setGameState);
    return () => unsubscribe();
  }, [room?.id]);

  /* ----- STEP 3: Countdown timer (3-2-1-Go!) ----- */
  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setShowCountdown(false);
          if (isHost && room) setGamePhase(room.id, 'playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdown, isHost, room?.id]);

  /* ----- STEP 4a: Race mode — per-question timer, resets each question ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    if (localIndex >= displayTotal) return;

    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          /* Auto-skip question when time expires (counts as wrong) */
          setLocalIndex((i) => i + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [localIndex, gameState?.phase, isSprint]);

  /* ----- STEP 4b: Sprint mode — single global countdown ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;

    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (isHost && room) setGamePhase(room.id, 'finished');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.phase, isSprint]);

  /* ----- STEP 5a: Record this player finished + first-to-finish ends game (Race) ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= displayTotal && !finishedRef.current) {
      finishedRef.current = true;
      recordPlayerFinished(room.id, currentPlayer.id).then(() => {
        /* Any player finishing ends the game for everyone */
        setGamePhase(room.id, 'finished');
      });
    }
  }, [localIndex]);

  /* ----- STEP 5b: Sprint — record finish when player reaches max rounds ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= displayTotal && !finishedRef.current) {
      finishedRef.current = true;
      recordPlayerFinished(room.id, currentPlayer.id);
    }
  }, [localIndex]);

  /* ----- STEP 5c: Sprint — host checks if ALL players finished their rounds ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !isHost || !gameState || gameState.phase !== 'playing') return;
    const finishTimes = gameState.finishTimes ?? {};
    const allFinished = room.players.every((p) => finishTimes[p.id]);
    if (allFinished) {
      setGamePhase(room.id, 'finished');
    }
  }, [gameState?.finishTimes, isHost, isSprint]);

  /* ----- Handle answer from player ----- */
  const handleAnswer = useCallback(
    async (answer: number) => {
      if (!gameState || !room || !currentPlayer) return;

      const currentQ = gameState.questions?.[localIndex];
      if (!currentQ) return;

      /* Only correct answers count toward score */
      if (answer === currentQ.correctAnswer) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, currentPlayer.id, newCount);
      }

      /* Always advance to the next question */
      setLocalIndex((prev) => prev + 1);
    },
    [gameState, room, currentPlayer, localIndex],
  );

  /* ----- Navigation guards ----- */
  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  /* Player finished their rounds but game not over yet (waiting for others in sprint) */
  const playerDone = localIndex >= displayTotal;

  if (gameState?.phase === 'finished') {
    const resultsTotal = displayTotal;

    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={resultsTotal}
        finishTimes={gameState.finishTimes}
        gameMode={settings?.gameMode ?? 'raceToFinish'}
        onPlayAgain={async () => { await replayRoom(room.id); navigate('/lobby'); }}
        onNewGame={() => { reset(); navigate('/'); }}
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

  /* Show waiting message when this player is done but game continues (sprint) */
  if (playerDone && isSprint) {
    return (
      <div className="page">
        <div className="card w-full max-w-md text-center">
          <p className="text-lg font-bold text-ludiko-purple mb-2">
            {t('game.finished')}
          </p>
          <p className="text-4xl font-extrabold text-ludiko-green mb-2">
            {gameState.progress[currentPlayer.id] ?? 0}/{displayTotal}
          </p>
          <p className="text-sm text-gray-500">{t('game.waitingForOthers')}</p>
          <span
            className={`inline-block mt-3 text-lg font-bold px-4 py-1 rounded-full ${
              timeRemaining <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-ludiko-blue/20'
            }`}
          >
            {timeRemaining}s
          </span>
        </div>
      </div>
    );
  }

  const currentQuestion = gameState.questions[localIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-6 flex-1">
        {/* Exit button */}
        <div className="flex justify-end">
          <button
            onClick={handleExit}
            className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
          >
            {t('game.exitGame')}
          </button>
        </div>

        {/* Race track (Race mode) or score display (Sprint mode) */}
        {!isSprint ? (
          <RaceTrack
            players={room.players}
            progress={gameState.progress}
            totalQuestions={displayTotal}
          />
        ) : (
          <div className="flex justify-between items-center w-full">
            <span className="text-lg font-bold text-ludiko-purple">
              {t('game.score')}: {gameState.progress[currentPlayer.id] ?? 0}
            </span>
            <span className="text-sm text-gray-500">
              {localIndex}/{displayTotal}
            </span>
            <span
              className={`text-lg font-bold px-4 py-1 rounded-full ${
                timeRemaining <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-ludiko-blue/20'
              }`}
            >
              {timeRemaining}s
            </span>
          </div>
        )}

        {currentQuestion && (
          <QuestionCard
            key={localIndex}
            question={currentQuestion}
            questionNumber={isSprint ? localIndex + 1 : localIndex + 1}
            totalQuestions={displayTotal}
            timeRemaining={isSprint ? undefined : timeRemaining}
            onAnswer={handleAnswer}
          />
        )}
      </div>
    </div>
  );
}
