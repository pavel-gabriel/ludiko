import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomStore } from '@/store/roomStore';
import { generateMemoryCards } from '@/services/gameEngine';
import {
  initMemoryGameState,
  listenToGameState,
  recordCorrectAnswer,
  setGamePhase,
  type RTDBGameState,
} from '@/services/gameSession';
import { updateRoomStatus } from '@/services/roomManager';
import { COUNTDOWN_SECONDS } from '@/utils/constants';
import type { MemoryCard } from '@/utils/types';
import CountdownOverlay from '@/components/games/MathRace/CountdownOverlay';
import MemoryBoard from './MemoryBoard';
import GameResults from '@/components/leaderboard/GameResults';

export default function MemoryGamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { room, currentPlayer, reset } = useRoomStore();

  const [gameState, setGameState] = useState<RTDBGameState | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showCountdown, setShowCountdown] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Local flip state (each player flips independently) */
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIndices, setMatchedIndices] = useState<Set<number>>(new Set());
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = currentPlayer?.isHost ?? false;
  const settings = room?.settings;
  const totalPairs = settings?.rounds ?? 8;

  const handleExit = useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]);

  /* Intercept browser back button */
  useEffect(() => {
    const onPopState = () => { handleExit(); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleExit]);

  /* ----- STEP 1: Host generates memory cards ----- */
  useEffect(() => {
    if (!room || !isHost || !settings) return;
    const memCards = generateMemoryCards(totalPairs);
    const playerIds = room.players.map((p) => p.id);
    initMemoryGameState(room.id, memCards, playerIds);
  }, [room?.id, isHost]);

  /* ----- STEP 2: Subscribe to game state ----- */
  useEffect(() => {
    if (!room) return;
    const unsub = listenToGameState(room.id, (state) => {
      setGameState(state);
      if (state?.memoryCards && cards.length === 0) {
        setCards(state.memoryCards);
      }
    });
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

  /* ----- STEP 4: Total time countdown ----- */
  useEffect(() => {
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
  }, [gameState?.phase]);

  /* ----- Handle card flip ----- */
  const handleFlip = useCallback(
    (index: number) => {
      if (checking || !gameState || !room || !currentPlayer) return;
      if (flippedIndices.includes(index) || matchedIndices.has(index)) return;
      if (gameState.phase !== 'playing') return;

      const newFlipped = [...flippedIndices, index];
      setFlippedIndices(newFlipped);

      if (newFlipped.length === 2) {
        setChecking(true);
        setTries((t) => t + 1);

        const [first, second] = newFlipped;
        const isMatch = cards[first].pairId === cards[second].pairId;

        flipTimeoutRef.current = setTimeout(async () => {
          if (isMatch) {
            const newMatched = new Set(matchedIndices);
            newMatched.add(first);
            newMatched.add(second);
            setMatchedIndices(newMatched);

            const pairsFound = newMatched.size / 2;
            await recordCorrectAnswer(room.id, currentPlayer.id, pairsFound);

            if (pairsFound >= cards.length / 2 && isHost) {
              await setGamePhase(room.id, 'finished');
            }
          }

          setFlippedIndices([]);
          setChecking(false);
        }, isMatch ? 500 : 800);
      }
    },
    [flippedIndices, matchedIndices, checking, cards, gameState, room, currentPlayer, isHost],
  );

  /* Cleanup timeout on unmount */
  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, []);

  if (!room || !currentPlayer) {
    navigate('/');
    return null;
  }

  if (showCountdown) return <CountdownOverlay count={countdown} />;

  /* Actual pairs in the game (cards.length / 2) */
  const actualPairs = cards.length > 0 ? cards.length / 2 : totalPairs;

  if (gameState?.phase === 'finished') {
    return (
      <GameResults
        players={room.players}
        scores={gameState.progress}
        totalQuestions={actualPairs}
        onPlayAgain={async () => { await updateRoomStatus(room.id, 'waiting'); navigate('/lobby'); }}
        onNewGame={() => { reset(); navigate('/'); }}
      />
    );
  }

  if (!gameState || cards.length === 0) {
    return (
      <div className="page">
        <p className="text-lg text-gray-500">{t('game.getReady')}</p>
      </div>
    );
  }

  const myScore = gameState.progress[currentPlayer.id] ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ludiko-pink/10 to-ludiko-yellow/10 px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-4 flex-1">
        {/* Exit button */}
        <div className="flex justify-end">
          <button
            onClick={handleExit}
            className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
          >
            {t('game.exitGame')}
          </button>
        </div>

        {/* Score header in a card */}
        <div className="card">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold bg-ludiko-green/20 text-ludiko-text px-3 py-1 rounded-full">
              {t('game.matchesFound')}: {myScore}/{actualPairs}
            </span>
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                timeRemaining <= 10
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-ludiko-blue/20 text-ludiko-text'
              }`}
            >
              {timeRemaining}s
            </span>
            <span className="text-sm font-bold bg-ludiko-purple/20 text-ludiko-text px-3 py-1 rounded-full">
              {t('game.tries')}: {tries}
            </span>
          </div>
        </div>

        {/* Card grid in a card container */}
        <div className="card flex-1 flex items-center justify-center">
          <MemoryBoard
            cards={cards}
            flippedIndices={flippedIndices}
            matchedIndices={matchedIndices}
            onFlip={handleFlip}
            disabled={checking || gameState.phase !== 'playing'}
          />
        </div>
      </div>
    </div>
  );
}
