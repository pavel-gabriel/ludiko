import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { generateQuestion } from '@/services/gameEngine';
import {
  initGameState,
  listenToGameState,
  recordCorrectAnswer,
  advanceQuestion,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
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

  /* In Timed Sprint, each player tracks their own local question index */
  const [localIndex, setLocalIndex] = useState(0);

  const isHost = currentPlayer?.isHost ?? false;
  const settings = room?.settings;
  const isSprint = settings?.gameMode === 'timedSprint';

  /* For display and scoring in Race mode */
  const displayTotal = settings?.rounds ?? 10;

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

  /* ----- STEP 4: Timer ----- */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || !settings) return;

    if (isSprint) {
      /* Timed Sprint: single global countdown from totalTime setting */
      setTimeRemaining(settings.timePerRound);
    } else {
      /* Race to Finish: per-question timer */
      setTimeRemaining(settings.timePerRound);
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (isSprint) {
            /* Sprint timer expired — end the game */
            if (isHost && room) setGamePhase(room.id, 'finished');
          } else {
            /* Race: time up on this question — auto-advance */
            if (isHost && room && gameState) handleTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    /* Sprint: only restart timer once (on phase change to playing).
       Race: restart on every question advance. */
  }, [isSprint ? gameState?.phase : gameState?.currentIndex, gameState?.phase]);

  /* ----- Handle answer from player ----- */
  const handleAnswer = useCallback(
    async (answer: number) => {
      if (!gameState || !room || !currentPlayer) return;

      const qIndex = isSprint ? localIndex : gameState.currentIndex;
      const currentQ = gameState.questions?.[qIndex];
      if (!currentQ) return;

      if (answer === currentQ.correctAnswer) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, currentPlayer.id, newCount);

        if (isSprint) {
          /* Sprint: advance to next question locally */
          setLocalIndex((prev) => prev + 1);
        } else {
          /* Race: check if player finished all questions */
          if (newCount >= displayTotal && isHost) {
            await setGamePhase(room.id, 'finished');
          }
        }
      }
    },
    [gameState, room, currentPlayer, displayTotal, isHost, isSprint, localIndex],
  );

  /* ----- Handle time up (Race mode: auto-advance, host only) ----- */
  const handleTimeUp = useCallback(async () => {
    if (!gameState || !room || !isHost) return;
    const nextIndex = gameState.currentIndex + 1;
    if (nextIndex >= displayTotal) {
      await setGamePhase(room.id, 'finished');
    } else {
      await advanceQuestion(room.id, nextIndex);
    }
  }, [gameState, room, isHost, displayTotal]);

  /* ----- Navigation guards ----- */
  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  if (gameState?.phase === 'finished') {
    /* In Sprint mode, totalQuestions for results = player's score (no fixed total) */
    const resultsTotal = isSprint
      ? Math.max(...Object.values(gameState.progress), 1)
      : displayTotal;

    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={resultsTotal}
        onPlayAgain={() => { reset(); navigate('/'); }}
        onExit={() => { reset(); navigate('/'); }}
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

  const qIndex = isSprint ? localIndex : gameState.currentIndex;
  const currentQuestion = gameState.questions[qIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 px-4 py-6 flex flex-col gap-6">
      {/* Race track (Race mode) or score display (Sprint mode) */}
      {!isSprint ? (
        <RaceTrack
          players={room.players}
          progress={gameState.progress}
          totalQuestions={displayTotal}
        />
      ) : (
        <div className="flex justify-between items-center max-w-md mx-auto w-full">
          <span className="text-lg font-bold text-ludiko-purple">
            {t('game.score')}: {gameState.progress[currentPlayer.id] ?? 0}
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
          question={currentQuestion}
          questionNumber={isSprint ? (gameState.progress[currentPlayer.id] ?? 0) + 1 : qIndex + 1}
          totalQuestions={isSprint ? undefined : displayTotal}
          timeRemaining={isSprint ? undefined : timeRemaining}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
