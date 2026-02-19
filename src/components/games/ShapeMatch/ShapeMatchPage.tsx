import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { generateShapeQuestion } from '@/services/gameEngine';
import {
  initShapeGameState,
  listenToGameState,
  recordCorrectAnswer,
  advanceQuestion,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import RaceTrack from '@/components/games/MathRace/RaceTrack';
import ShapeCard from './ShapeCard';
import GameResults from '@/components/leaderboard/GameResults';

/**
 * Shape Match game page.
 * Same multiplayer flow as Math Race but with shape identification questions.
 */
export default function ShapeMatchPage() {
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

  /* ----- STEP 1: Host generates shape questions ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;

    const questions = Array.from({ length: totalQuestions }, () =>
      generateShapeQuestion(settings.difficulty),
    );
    const playerIds = room.players.map((p) => p.id);
    initShapeGameState(room.id, questions, playerIds);
  }, [room?.id, isHost]);

  /* ----- STEP 2: Subscribe to game state ----- */
  useEffect(() => {
    if (!room) return;
    const unsub = listenToGameState(room.id, setGameState);
    return () => unsub();
  }, [room?.id]);

  /* ----- STEP 3: Countdown ----- */
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

  /* ----- STEP 4: Per-question timer ----- */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (isHost && room) handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.currentIndex, gameState?.phase]);

  /* ----- Handle shape answer ----- */
  const handleAnswer = useCallback(
    async (correct: boolean) => {
      if (!gameState || !room || !currentPlayer) return;
      if (correct) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, currentPlayer.id, newCount);
        if (newCount >= totalQuestions && isHost) {
          await setGamePhase(room.id, 'finished');
        }
      }
    },
    [gameState, room, currentPlayer, totalQuestions, isHost],
  );

  /* ----- Handle time up ----- */
  const handleTimeUp = useCallback(async () => {
    if (!gameState || !room || !isHost) return;
    const next = gameState.currentIndex + 1;
    if (next >= totalQuestions) {
      await setGamePhase(room.id, 'finished');
    } else {
      await advanceQuestion(room.id, next);
    }
  }, [gameState, room, isHost, totalQuestions]);

  /* ----- Navigation guard ----- */
  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  if (gameState?.phase === 'finished') {
    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={totalQuestions}
        onPlayAgain={() => { reset(); navigate('/'); }}
        onExit={() => { reset(); navigate('/'); }}
      />
    );
  }

  if (!gameState || !gameState.shapeQuestions?.length) {
    return (
      <div className="page">
        <p className="text-lg text-gray-500">{t('game.getReady')}</p>
      </div>
    );
  }

  const currentQ = gameState.shapeQuestions[gameState.currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-green/10 to-ludiko-blue/10 px-4 py-6 flex flex-col gap-6">
      <RaceTrack
        players={room.players}
        progress={gameState.progress}
        totalQuestions={totalQuestions}
      />
      {currentQ && (
        <ShapeCard
          question={currentQ}
          questionNumber={gameState.currentIndex + 1}
          totalQuestions={totalQuestions}
          timeRemaining={timeRemaining}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
