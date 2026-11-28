import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { useSessionPort } from '@/services/session';
import type { RTDBGameState } from '@/services/gameState';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import RaceTrack from '@/components/games/MathRace/RaceTrack';
import ShapeCard from './ShapeCard';
import GameResults from '@/components/leaderboard/GameResults';

export default function ShapeMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset, setRoom } = useRoomStore();
  const port = useSessionPort(room);

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
    if (isHost && room) void port.close();
    reset();
    navigate('/');
  }, [reset, navigate, isHost, room, port]);

  /* Intercept browser back button */
  useEffect(() => {
    const onPopState = () => { handleExit(); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleExit]);

  /* Listen for room changes — handle deletion (host left) and replay (back to waiting) */
  useEffect(() => {
    if (!room) return;
    const unsub = port.listenRoom((r) => {
      if (!r) { reset(); navigate('/'); return; }
      /* Keep players list fresh (disconnects) so finish checks stay correct */
      setRoom({ ...r, id: room.id });
      if (r.status === 'waiting') { navigate('/lobby'); }
    });
    return () => unsub();
  }, [room?.id]);

  /* ----- STEP 1: Host generates questions ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;
    const playerIds = room.players.map((p) => p.id);
    void port.initGame(settings, playerIds);
  }, [room?.id, isHost]);

  /* ----- STEP 2: Subscribe to game state ----- */
  useEffect(() => {
    if (!room) return;
    const unsub = port.listenGame(setGameState);
    return () => unsub();
  }, [room?.id]);

  /* ----- STEP 3: Countdown ----- */
  useEffect(() => {
    if (!showCountdown) return;
    /* Tick count kept locally: side effects run once in the interval, never inside a state updater */
    let left = countdown;
    const interval = setInterval(() => {
      if (left <= 0) {
        clearInterval(interval);
        setShowCountdown(false);
        if (isHost && room) port.setPhase('playing');
        return;
      }
      left -= 1;
      setCountdown(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdown, isHost, room?.id]);

  /* ----- STEP 4a: Race mode — per-question timer ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    if (localIndex >= totalQuestions) return;

    /* Clock kept locally: expiry side effects run once, never inside a state updater */
    let remaining = settings.timePerRound;
    setTimeRemaining(remaining);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (remaining <= 1) {
        clearInterval(timerRef.current!);
        setTimeRemaining(0);
        setLocalIndex((i) => i + 1);
        return;
      }
      remaining -= 1;
      setTimeRemaining(remaining);
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [localIndex, gameState?.phase, isSprint]);

  /* ----- STEP 4b: Sprint mode — single global countdown ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;

    /* Clock kept locally: expiry side effects run once, never inside a state updater */
    let remaining = settings.timePerRound;
    setTimeRemaining(remaining);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (remaining <= 1) {
        clearInterval(timerRef.current!);
        setTimeRemaining(0);
        if (isHost && room) port.setPhase('finished');
        return;
      }
      remaining -= 1;
      setTimeRemaining(remaining);
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.phase, isSprint]);

  /* ----- STEP 5a: Race — first player to finish ends game ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= totalQuestions && !finishedRef.current) {
      finishedRef.current = true;
      port.recordPlayerFinished(currentPlayer.id).then(() => {
        port.setPhase('finished');
      });
    }
  }, [localIndex]);

  /* ----- STEP 5b: Sprint — record finish when player reaches max rounds ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !currentPlayer || !gameState || gameState.phase !== 'playing') return;
    if (localIndex >= totalQuestions && !finishedRef.current) {
      finishedRef.current = true;
      port.recordPlayerFinished(currentPlayer.id);
    }
  }, [localIndex]);

  /* ----- STEP 5c: Sprint — host checks if ALL players finished ----- */
  useEffect(() => {
    if (!isSprint) return;
    if (!room || !isHost || !gameState || gameState.phase !== 'playing') return;
    const finishTimes = gameState.finishTimes ?? {};
    const allFinished = room.players.every((p) => finishTimes[p.id]);
    if (allFinished) {
      port.setPhase('finished');
    }
  }, [gameState?.finishTimes, isHost, isSprint]);

  const handleAnswer = useCallback(
    async (correct: boolean) => {
      if (!gameState || !room || !currentPlayer) return;
      if (correct) {
        const newCount = (gameState.progress[currentPlayer.id] ?? 0) + 1;
        await port.recordCorrectAnswer(currentPlayer.id, newCount);
      }
      setLocalIndex((prev) => prev + 1);
    },
    [gameState, room, currentPlayer, port],
  );

  if (!room || !currentPlayer) {
    return <Navigate to="/" replace />;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  const playerDone = localIndex >= totalQuestions;

  const isSinglePlayer = room.players.length === 1 && !room.classroomSessionId;
  const restartInPlace = isSinglePlayer || port.local;

  if (gameState?.phase === 'finished') {
    const handleReplay = async () => {
      if (restartInPlace) {
        setLocalIndex(0);
        finishedRef.current = false;
        setShowCountdown(true);
        setCountdown(COUNTDOWN_SECONDS);
        if (settings) await port.initGame(settings, [currentPlayer.id]);
      } else {
        await port.replay();
        navigate('/lobby');
      }
    };

    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={totalQuestions}
        finishTimes={gameState.finishTimes}
        gameMode={settings?.gameMode ?? 'raceToFinish'}
        startedAt={gameState.startedAt}
        isSinglePlayer={isSinglePlayer}
        onPlayAgain={handleReplay}
        onNewGame={async () => { await port.leave(currentPlayer.id); reset(); navigate('/'); }}
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
    <div className="min-h-screen bg-gradient-to-b from-ludiko-green/10 to-ludiko-blue/10 px-4 py-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md flex flex-col gap-6 relative">
        <button
          onClick={handleExit}
          aria-label={t('game.exitGame')}
          className="absolute -top-2 right-0 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {!isSprint && !isSinglePlayer ? (
          <RaceTrack
            players={room.players}
            progress={gameState.progress}
            totalQuestions={totalQuestions}
          />
        ) : isSprint ? (
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
        ) : null}

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
