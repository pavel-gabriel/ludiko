import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { initRoomGame } from '@/services/roomGame';
import {
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { replayRoom, deleteRoom, removePlayer, listenToRoom } from '@/services/roomManager';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import RaceTrack from './RaceTrack';
import QuestionCard from './QuestionCard';
import CountdownOverlay from './CountdownOverlay';
import GameResults from '@/components/leaderboard/GameResults';
import ItemQuestionCard from '@/components/games/shared/ItemQuestionCard';

/** Sprint answers are confirmed quickly: the clock is running */
const SPRINT_FEEDBACK_MS = 350;

export default function MathRacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset, setRoom } = useRoomStore();

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

  /* For display and scoring in Race mode. Item games (v2) can hold fewer items than rounds asked for */
  const itemCount = gameState?.items?.length;
  const displayTotal = itemCount ? Math.min(settings?.rounds ?? 10, itemCount) : (settings?.rounds ?? 10);

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

  /* Listen for room changes — handle deletion (host left) and replay (back to waiting) */
  useEffect(() => {
    if (!room) return;
    const unsub = listenToRoom(room.id, (r) => {
      if (!r) { reset(); navigate('/'); return; }
      /* Keep players list fresh (disconnects) so finish checks stay correct */
      setRoom({ ...r, id: room.id });
      /* Replay triggered: room went back to waiting — return to lobby */
      if (r.status === 'waiting') { navigate('/lobby'); }
    });
    return () => unsub();
  }, [room?.id]);

  /* ----- STEP 1: Host generates questions (v1) or items (v2, settings.skillIds) and pushes game state ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;
    const playerIds = room.players.map((p) => p.id);
    initRoomGame(room.id, settings, playerIds);
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
    /* Tick count kept locally: side effects run once in the interval, never inside a state updater */
    let left = countdown;
    const interval = setInterval(() => {
      if (left <= 0) {
        clearInterval(interval);
        setShowCountdown(false);
        if (isHost && room) setGamePhase(room.id, 'playing');
        return;
      }
      left -= 1;
      setCountdown(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdown, isHost, room?.id]);

  /* ----- STEP 4a: Race mode — per-question timer, resets each question ----- */
  useEffect(() => {
    if (isSprint) return;
    if (!gameState || gameState.phase !== 'playing' || !settings) return;
    if (localIndex >= displayTotal) return;

    /* Clock kept locally: expiry side effects run once, never inside a state updater */
    let remaining = settings.timePerRound;
    setTimeRemaining(remaining);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (remaining <= 1) {
        clearInterval(timerRef.current!);
        setTimeRemaining(0);
        /* Auto-skip question when time expires (counts as wrong) */
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
        if (isHost && room) setGamePhase(room.id, 'finished');
        return;
      }
      remaining -= 1;
      setTimeRemaining(remaining);
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

  /* ----- Handle answer to an item (v2): one point per correct item ----- */
  const handleItemResult = useCallback(
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

  /* ----- Navigation guards ----- */
  if (!room || !currentPlayer) {
    return <Navigate to="/" replace />;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  /* Player finished their rounds but game not over yet (waiting for others in sprint) */
  const playerDone = localIndex >= displayTotal;

  const isSinglePlayer = room.players.length === 1 && !room.classroomSessionId;

  if (gameState?.phase === 'finished') {
    const resultsTotal = displayTotal;

    const handleReplay = async () => {
      if (isSinglePlayer) {
        /* Single player: restart game in-place instead of going to lobby */
        setLocalIndex(0);
        finishedRef.current = false;
        setShowCountdown(true);
        setCountdown(COUNTDOWN_SECONDS);
        /* Re-generate questions/items and re-init game state */
        if (settings) await initRoomGame(room.id, settings, [currentPlayer.id]);
      } else {
        await replayRoom(room.id);
        navigate('/lobby');
      }
    };

    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={resultsTotal}
        finishTimes={gameState.finishTimes}
        gameMode={settings?.gameMode ?? 'raceToFinish'}
        startedAt={gameState.startedAt}
        isSinglePlayer={isSinglePlayer}
        onPlayAgain={handleReplay}
        onNewGame={async () => { await removePlayer(room.id, currentPlayer.id); reset(); navigate('/'); }}
      />
    );
  }

  if (!gameState || !(gameState.questions?.length || gameState.items?.length)) {
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

  const currentQuestion = gameState.questions?.[localIndex];
  const currentItem = gameState.items?.[localIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 px-4 py-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md flex flex-col gap-6 relative">
        {/* Exit button */}
        <button
          onClick={handleExit}
          aria-label={t('game.exitGame')}
          className="absolute -top-2 right-0 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Race track (Race mode, multiplayer only) or score display (Sprint mode) */}
        {!isSprint && !isSinglePlayer ? (
          <RaceTrack
            players={room.players}
            progress={gameState.progress}
            totalQuestions={displayTotal}
          />
        ) : isSprint ? (
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
        ) : null}

        {currentItem && (
          <ItemQuestionCard
            key={`${localIndex}:${currentItem.id}`}
            item={currentItem}
            questionNumber={localIndex + 1}
            totalQuestions={displayTotal}
            timeRemaining={isSprint ? undefined : timeRemaining}
            feedbackMs={isSprint ? SPRINT_FEEDBACK_MS : undefined}
            onResult={handleItemResult}
          />
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
