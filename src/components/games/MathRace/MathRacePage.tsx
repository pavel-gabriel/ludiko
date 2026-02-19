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

export default function MathRacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset } = useRoomStore();

  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showCountdown, setShowCountdown] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHost = currentPlayer?.isHost ?? false;
  const settings = room?.settings;
  const totalQuestions = settings?.rounds ?? 10;

  /* ----- STEP 1: Host generates questions and pushes game state ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;

    const questions: Question[] = [];
    for (let i = 0; i < totalQuestions; i++) {
      questions.push(generateQuestion(settings.difficulty, settings.operations));
    }

    const playerIds = room.players.map((p) => p.id);
    initGameState(room.id, questions, playerIds);
  }, [room?.id, isHost]);

  /* ----- STEP 2: Subscribe to game state from RTDB ----- */
  useEffect(() => {
    if (!room) return;

    const unsubscribe = listenToGameState(room.id, (state) => {
      setGameState(state);
    });

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
          /* Host sets phase to 'playing' after countdown */
          if (isHost && room) {
            setGamePhase(room.id, 'playing');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showCountdown, isHost, room?.id]);

  /* ----- STEP 4: Per-question timer ----- */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || !settings) return;

    setTimeRemaining(settings.timePerRound);

    /* Clear any existing timer */
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          /* Time's up — auto-advance (host only) */
          if (isHost && room && gameState) {
            handleTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.currentIndex, gameState?.phase]);

  /* ----- Handle answer from player ----- */
  const handleAnswer = useCallback(
    async (answer: number) => {
      if (!gameState || !room || !currentPlayer) return;

      const currentQ = gameState.questions[gameState.currentIndex];
      if (!currentQ) return;

      if (answer === currentQ.correctAnswer) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, currentPlayer.id, newCount);

        /* Check if this player finished all questions */
        if (newCount >= totalQuestions && isHost) {
          await setGamePhase(room.id, 'finished');
        }
      }
    },
    [gameState, room, currentPlayer, totalQuestions, isHost],
  );

  /* ----- Handle time up (auto-advance to next question, host only) ----- */
  const handleTimeUp = useCallback(async () => {
    if (!gameState || !room || !isHost) return;

    const nextIndex = gameState.currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      await setGamePhase(room.id, 'finished');
    } else {
      await advanceQuestion(room.id, nextIndex);
    }
  }, [gameState, room, isHost, totalQuestions]);

  /* ----- Navigation guards ----- */
  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  /* ----- RENDER: Countdown overlay ----- */
  if (showCountdown) {
    return <CountdownOverlay count={countdown} />;
  }

  /* ----- RENDER: Finished — show results ----- */
  if (gameState?.phase === 'finished') {
    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={totalQuestions}
        onPlayAgain={() => {
          reset();
          navigate('/');
        }}
        onExit={() => {
          reset();
          navigate('/');
        }}
      />
    );
  }

  /* ----- RENDER: Waiting for game state ----- */
  if (!gameState || !gameState.questions?.length) {
    return (
      <div className="page">
        <p className="text-lg text-gray-500">{t('game.getReady')}</p>
      </div>
    );
  }

  const currentQuestion = gameState.questions[gameState.currentIndex];

  /* ----- RENDER: Active game — race track + question ----- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 px-4 py-6 flex flex-col gap-6">
      {/* Race track at the top */}
      <RaceTrack
        players={room.players}
        progress={gameState.progress}
        totalQuestions={totalQuestions}
      />

      {/* Question card below the track */}
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          questionNumber={gameState.currentIndex + 1}
          totalQuestions={totalQuestions}
          timeRemaining={timeRemaining}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
