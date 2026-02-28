import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { useAuthStore } from '@/store/authStore';
import { generateQuestion, generateShapeQuestion, generateMemoryCards } from '@/services/gameEngine';
import {
  initMathGameState,
  initShapeGameState,
  initMemoryGameState,
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { deleteRoom } from '@/services/roomManager';
import type { Question, ShapeQuestion as ShapeQ } from '@/utils/types';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import GameResults from '@/components/leaderboard/GameResults';
import InteractiveQuestionPanel from './InteractiveQuestionPanel';
import InteractiveShapePanel from './InteractiveShapePanel';
import InteractiveMemoryPanel from './InteractiveMemoryPanel';
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

  /* Each player tracks their own question index locally (math & shape) */
  const [localIndex1, setLocalIndex1] = useState(0);
  const [localIndex2, setLocalIndex2] = useState(0);
  /* Memory game: track matched pairs count locally per player */
  const [memoryScore1, setMemoryScore1] = useState(0);
  const [memoryScore2, setMemoryScore2] = useState(0);
  const finished1Ref = useRef(false);
  const finished2Ref = useRef(false);

  const settings = room?.settings;
  const gameType = settings?.gameType ?? 'mathRace';
  const isMemory = gameType === 'memoryGame';
  const displayTotal = settings?.rounds ?? 10;

  const player1 = room?.players[0];
  const player2 = room?.players[1];

  const exitTarget = uid ? '/teacher' : '/';

  const handleExit = useCallback(() => {
    if (room) deleteRoom(room.id);
    reset();
    navigate(exitTarget);
  }, [reset, navigate, room, exitTarget]);

  /* Intercept browser back button */
  useEffect(() => {
    const onPopState = () => { handleExit(); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleExit]);

  /* Host generates questions / cards based on game type */
  useEffect(() => {
    if (!room || !settings) return;
    const playerIds = room.players.map((p) => p.id);

    if (gameType === 'shapeMatch') {
      const questions: ShapeQ[] = [];
      for (let i = 0; i < displayTotal; i++) {
        questions.push(generateShapeQuestion(settings.difficulty));
      }
      initShapeGameState(room.id, questions, playerIds);
    } else if (gameType === 'memoryGame') {
      const cards = generateMemoryCards(displayTotal);
      initMemoryGameState(room.id, cards, playerIds);
    } else {
      const questions: Question[] = [];
      for (let i = 0; i < displayTotal; i++) {
        questions.push(generateQuestion(settings.difficulty, settings.operations));
      }
      initMathGameState(room.id, questions, playerIds);
    }
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

  /* Timer — per-question for math/shape, global for memory */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || !settings) return;

    if (isMemory) {
      /* Global countdown timer for memory */
      setTimeRemaining(settings.timePerRound);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            if (room) setGamePhase(room.id, 'finished');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }

    /* Per-question timer for math & shape */
    const minIndex = Math.min(localIndex1, localIndex2);
    if (minIndex >= displayTotal) return;

    setTimeRemaining(settings.timePerRound);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setLocalIndex1((i) => (i < displayTotal ? i + 1 : i));
          setLocalIndex2((i) => (i < displayTotal ? i + 1 : i));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [
    isMemory ? gameState?.phase : Math.min(localIndex1, localIndex2),
    gameState?.phase,
  ]);

  /* Check finish for player 1 */
  useEffect(() => {
    if (!room || !player1 || !gameState || gameState.phase !== 'playing') return;
    const done = isMemory ? memoryScore1 >= displayTotal : localIndex1 >= displayTotal;
    if (done && !finished1Ref.current) {
      finished1Ref.current = true;
      recordPlayerFinished(room.id, player1.id);
    }
  }, [localIndex1, memoryScore1]);

  /* Check finish for player 2 */
  useEffect(() => {
    if (!room || !player2 || !gameState || gameState.phase !== 'playing') return;
    const done = isMemory ? memoryScore2 >= displayTotal : localIndex2 >= displayTotal;
    if (done && !finished2Ref.current) {
      finished2Ref.current = true;
      recordPlayerFinished(room.id, player2.id);
    }
  }, [localIndex2, memoryScore2]);

  /* Either player finishes -> end game (race to finish) */
  useEffect(() => {
    if (!room || !gameState || gameState.phase !== 'playing') return;
    if (finished1Ref.current || finished2Ref.current) {
      setGamePhase(room.id, 'finished');
    }
  }, [localIndex1, localIndex2, memoryScore1, memoryScore2, gameState?.phase]);

  /* Math answer handlers */
  const handleMathAnswer1 = useCallback(
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

  const handleMathAnswer2 = useCallback(
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

  /* Shape answer handlers */
  const handleShapeAnswer1 = useCallback(
    async (correct: boolean) => {
      if (!room || !player1 || !gameState) return;
      if (correct) {
        const newCount = (gameState.progress[player1.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, player1.id, newCount);
      }
      setLocalIndex1((prev) => prev + 1);
    },
    [room, player1, gameState],
  );

  const handleShapeAnswer2 = useCallback(
    async (correct: boolean) => {
      if (!room || !player2 || !gameState) return;
      if (correct) {
        const newCount = (gameState.progress[player2.id] ?? 0) + 1;
        await recordCorrectAnswer(room.id, player2.id, newCount);
      }
      setLocalIndex2((prev) => prev + 1);
    },
    [room, player2, gameState],
  );

  /* Memory match handlers */
  const handleMemoryMatch1 = useCallback(async () => {
    if (!room || !player1 || !gameState) return;
    const newCount = (gameState.progress[player1.id] ?? 0) + 1;
    await recordCorrectAnswer(room.id, player1.id, newCount);
    setMemoryScore1((prev) => prev + 1);
  }, [room, player1, gameState]);

  const handleMemoryMatch2 = useCallback(async () => {
    if (!room || !player2 || !gameState) return;
    const newCount = (gameState.progress[player2.id] ?? 0) + 1;
    await recordCorrectAnswer(room.id, player2.id, newCount);
    setMemoryScore2((prev) => prev + 1);
  }, [room, player2, gameState]);

  /* Navigation guards */
  if (!room || !currentPlayer || !player1 || !player2) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  /* Replay: regenerate questions/cards */
  const handleReplay = async () => {
    if (!room || !settings) return;
    setLocalIndex1(0);
    setLocalIndex2(0);
    setMemoryScore1(0);
    setMemoryScore2(0);
    finished1Ref.current = false;
    finished2Ref.current = false;
    setShowCountdown(true);
    setCountdown(COUNTDOWN_SECONDS);

    const playerIds = room.players.map((p) => p.id);
    if (gameType === 'shapeMatch') {
      const qs: ShapeQ[] = [];
      for (let i = 0; i < displayTotal; i++) qs.push(generateShapeQuestion(settings.difficulty));
      await initShapeGameState(room.id, qs, playerIds);
    } else if (gameType === 'memoryGame') {
      const cards = generateMemoryCards(displayTotal);
      await initMemoryGameState(room.id, cards, playerIds);
    } else {
      const qs: Question[] = [];
      for (let i = 0; i < displayTotal; i++) qs.push(generateQuestion(settings.difficulty, settings.operations));
      await initMathGameState(room.id, qs, playerIds);
    }
  };

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
        onNewGame={() => { if (room) deleteRoom(room.id); reset(); navigate(exitTarget); }}
      />
    );
  }

  /* Loading guard — check based on game type */
  const isReady = gameState && (
    gameType === 'memoryGame'
      ? gameState.memoryCards && gameState.memoryCards.length > 0
      : gameType === 'shapeMatch'
        ? gameState.shapeQuestions && gameState.shapeQuestions.length > 0
        : gameState.questions && gameState.questions.length > 0
  );

  if (!isReady) {
    return (
      <div className="page">
        <p className="text-lg text-gray-500">{t('game.getReady')}</p>
      </div>
    );
  }

  /* Render player panels based on game type */
  const renderPanel1 = () => {
    if (gameType === 'memoryGame') {
      return (
        <InteractiveMemoryPanel
          cards={gameState!.memoryCards!}
          totalPairs={displayTotal}
          matchedCount={memoryScore1}
          onMatchFound={handleMemoryMatch1}
          colorAccent="blue"
        />
      );
    }
    if (gameType === 'shapeMatch') {
      const q = gameState!.shapeQuestions![localIndex1];
      if (localIndex1 >= displayTotal || !q) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
          </div>
        );
      }
      return (
        <InteractiveShapePanel
          key={`p1-${localIndex1}`}
          question={q}
          questionNumber={localIndex1 + 1}
          totalQuestions={displayTotal}
          timeRemaining={timeRemaining}
          shapeMode={settings?.shapeMode ?? 'image'}
          onAnswer={handleShapeAnswer1}
          colorAccent="blue"
        />
      );
    }
    /* mathRace */
    const q = gameState!.questions![localIndex1];
    if (localIndex1 >= displayTotal || !q) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
        </div>
      );
    }
    return (
      <InteractiveQuestionPanel
        key={`p1-${localIndex1}`}
        question={q}
        questionNumber={localIndex1 + 1}
        totalQuestions={displayTotal}
        timeRemaining={timeRemaining}
        onAnswer={handleMathAnswer1}
        colorAccent="blue"
      />
    );
  };

  const renderPanel2 = () => {
    if (gameType === 'memoryGame') {
      return (
        <InteractiveMemoryPanel
          cards={gameState!.memoryCards!}
          totalPairs={displayTotal}
          matchedCount={memoryScore2}
          onMatchFound={handleMemoryMatch2}
          colorAccent="pink"
        />
      );
    }
    if (gameType === 'shapeMatch') {
      const q = gameState!.shapeQuestions![localIndex2];
      if (localIndex2 >= displayTotal || !q) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
          </div>
        );
      }
      return (
        <InteractiveShapePanel
          key={`p2-${localIndex2}`}
          question={q}
          questionNumber={localIndex2 + 1}
          totalQuestions={displayTotal}
          timeRemaining={timeRemaining}
          shapeMode={settings?.shapeMode ?? 'image'}
          onAnswer={handleShapeAnswer2}
          colorAccent="pink"
        />
      );
    }
    /* mathRace */
    const q = gameState!.questions![localIndex2];
    if (localIndex2 >= displayTotal || !q) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
        </div>
      );
    }
    return (
      <InteractiveQuestionPanel
        key={`p2-${localIndex2}`}
        question={q}
        questionNumber={localIndex2 + 1}
        totalQuestions={displayTotal}
        timeRemaining={timeRemaining}
        onAnswer={handleMathAnswer2}
        colorAccent="pink"
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-blue/10 to-ludiko-purple/10 flex flex-col" role="main">
      {/* Exit button + optional global timer for memory */}
      <div className="flex justify-between items-center px-4 pt-3">
        {isMemory ? (
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              timeRemaining <= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}
            aria-live="polite"
          >
            {timeRemaining}s
          </span>
        ) : (
          <span />
        )}
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

      {/* Race track (math & shape only) */}
      {!isMemory && (
        <div className="px-4 py-2">
          <RaceTrack
            players={room.players}
            progress={gameState.progress}
            totalQuestions={displayTotal}
          />
        </div>
      )}

      {/* Split screen — two game panels side by side */}
      <div className="flex flex-1 gap-1 px-1 pb-2 min-h-0">
        {/* Player 1 panel */}
        <div className="flex-1 flex flex-col min-w-0" role="region" aria-label={player1.name}>
          <div className="text-center py-1">
            <span className="text-lg" aria-hidden="true">{player1.avatar}</span>
            <span className="text-xs font-bold ml-1 truncate">{player1.name}</span>
          </div>
          {renderPanel1()}
        </div>

        {/* Divider */}
        <div className="w-0.5 bg-gray-300 self-stretch my-2 rounded-full" />

        {/* Player 2 panel */}
        <div className="flex-1 flex flex-col min-w-0" role="region" aria-label={player2.name}>
          <div className="text-center py-1">
            <span className="text-lg" aria-hidden="true">{player2.avatar}</span>
            <span className="text-xs font-bold ml-1 truncate">{player2.name}</span>
          </div>
          {renderPanel2()}
        </div>
      </div>
    </div>
  );
}
