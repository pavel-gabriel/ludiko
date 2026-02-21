import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { generateShapeQuestion } from '@/services/gameEngine';
import {
  initShapeGameState,
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { replayRoom, deleteRoom, listenToRoom } from '@/services/roomManager';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import RaceTrack from '@/components/games/MathRace/RaceTrack';
import ShapeCard from './ShapeCard';
import GameResults from '@/components/leaderboard/GameResults';

/** Large question pool for Timed Sprint */
const SPRINT_POOL_SIZE = 100;

export default function ShapeMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset } = useRoomStore();

  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showCountdown, setShowCountdown] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const [localIndex, setLocalIndex] = useState(0);

  const isHost = currentPlayer?.isHost ?? false;
  const settings = room?.settings;
  const isSprint = settings?.gameMode === 'timedSprint';
  const totalQuestions = settings?.rounds ?? 10;
  const shapeMode = settings?.shapeMode ?? 'image';

  const handleExit = useCallback(() => {
    if (isHost && room) deleteRoom(room.id);
    reset();
    navigate('/');
  }, [reset, navigate, isHost, room]);

  /* Intercept browser back button */
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

  /* ----- STEP 1: Host generates questions ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;
    const count = isSprint ? SPRINT_POOL_SIZE : totalQuestions;
    const questions = Array.from({ length: count }, () =>
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

  /* ----- STEP 4a: Race mode — per-question timer ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    if (localIndex >= totalQuestions) return;

    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
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

  /* ----- STEP 5a: Race — first player to finish ends game ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= totalQuestions && !finishedRef.current) {
      finishedRef.current = true;
      recordPlayerFinished(room.id, currentPlayer.id).then(() => {
        setGamePhase(room.id, 'finished');
      });
    }
  }, [localIndex]);

  /* ----- STEP 5b: Sprint — record finish when player reaches max rounds ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= totalQuestions && !finishedRef.current) {
      finishedRef.current = true;
      recordPlayerFinished(room.id, currentPlayer.id);
    }
  }, [localIndex]);

  /* ----- STEP 5c: Sprint — host checks if ALL players finished ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !isHost || !gameState || gameState.phase !== 'playing') return;
    const finishTimes = gameState.finishTimes ?? {};
    const allFinished = room.players.every((p) => finishTimes[p.id]);
    if (allFinished) {
      setGamePhase(room.id, 'finished');
    }
  }, [gameState?.finishTimes, isHost, isSprint]);

  const handleAnswer = useCallback(
    async (correct: boolean) => {
      if (!gameState || !room || !currentPlayer) return;
      if (correct) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, currentPlayer.id, newCount);
      }
      setLocalIndex((prev) => prev + 1);
    },
    [gameState, room, currentPlayer],
  );

  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  const playerDone = localIndex >= totalQuestions;

  if (gameState?.phase === 'finished') {
    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={totalQuestions}
        finishTimes={gameState.finishTimes}
        gameMode={settings?.gameMode ?? 'raceToFinish'}
        onPlayAgain={async () => { await replayRoom(room.id); navigate('/lobby'); }}
        onNewGame={() => { reset(); navigate('/'); }}
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

  /* Show waiting message when this player is done but game continues (sprint) */
  if (playerDone && isSprint) {
    return (
      <div className="page">
        <div className="card w-full max-w-md text-center">
          <p className="text-lg font-bold text-ludiko-purple mb-2">
            {t('game.finished')}
          </p>
          <p className="text-4xl font-extrabold text-ludiko-green mb-2">
            {gameState.progress[currentPlayer.id] ?? 0}/{totalQuestions}
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

  const currentQ = gameState.shapeQuestions[localIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-green/10 to-ludiko-blue/10 px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-6 flex-1">
        <div className="flex justify-end">
          <button
            onClick={handleExit}
            className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
          >
            {t('game.exitGame')}
          </button>
        </div>

        {!isSprint ? (
          <RaceTrack
            players={room.players}
            progress={gameState.progress}
            totalQuestions={totalQuestions}
          />
        ) : (
          <div className="flex justify-between items-center w-full">
            <span className="text-lg font-bold text-ludiko-purple">
              {t('game.score')}: {gameState.progress[currentPlayer.id] ?? 0}
            </span>
            <span className="text-sm text-gray-500">
              {localIndex}/{totalQuestions}
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

        {currentQ && (
          <ShapeCard
            key={localIndex}
            question={currentQ}
            questionNumber={localIndex + 1}
            totalQuestions={totalQuestions}
            timeRemaining={isSprint ? undefined : timeRemaining}
            shapeMode={shapeMode}
            onAnswer={handleAnswer}
          />
        )}
      </div>
    </div>
  );
}
