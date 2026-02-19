import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import type { Difficulty, Operation, GameType, GameMode } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS, GAME_TYPES } from '@/utils/constants';

export default function CreateRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>(DEFAULT_GAME_SETTINGS.gameType);
  const [gameMode, setGameMode] = useState<GameMode>(DEFAULT_GAME_SETTINGS.gameMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SETTINGS.difficulty);
  const [rounds, setRounds] = useState(DEFAULT_GAME_SETTINGS.rounds);
  const [timePerRound, setTimePerRound] = useState(DEFAULT_GAME_SETTINGS.timePerRound);
  const [operations, setOperations] = useState<Operation[]>(DEFAULT_GAME_SETTINGS.operations);
  const [loading, setLoading] = useState(false);

  const toggleOperation = (op: Operation) => {
    setOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  /** Math Race needs operations; Shape Match & Memory don't */
  const showMathOptions = gameType === 'mathRace';
  /** Timed Sprint only applies to Math Race and Shape Match */
  const showModeSelector = gameType !== 'memoryGame';
  /** Memory game uses "pairs" instead of "rounds" */
  const isMemory = gameType === 'memoryGame';

  const handleCreate = async () => {
    if (!name.trim() || loading) return;
    if (showMathOptions && operations.length === 0) return;
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      const room = buildRoom(name.trim(), {
        gameType,
        gameMode: isMemory ? 'raceToFinish' : gameMode,
        difficulty,
        operations: showMathOptions ? operations : ['+'],
        rounds,
        timePerRound,
      });
      await createRoomInDB(room);
      registerDisconnectCleanup(room.id, true);
      setRoom(room);
      setCurrentPlayer(room.players[0]);
      navigate('/lobby');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">{t('create.title')}</h2>

        {/* Name */}
        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.yourName')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('create.namePlaceholder')}
            className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
            maxLength={20}
            aria-label={t('create.yourName')}
          />
        </label>

        {/* Game type selector */}
        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.gameType')}</span>
          <div className="flex gap-2 mt-1">
            {GAME_TYPES.map(({ type, emoji, labelKey }) => (
              <button
                key={type}
                onClick={() => setGameType(type)}
                aria-pressed={gameType === type}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                  gameType === type
                    ? 'bg-ludiko-purple text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {emoji} {t(labelKey)}
              </button>
            ))}
          </div>
        </label>

        {/* Game mode selector (not for Memory) */}
        {showModeSelector && (
          <label className="block mb-4">
            <span className="text-sm font-semibold">{t('create.gameMode')}</span>
            <div className="flex gap-2 mt-1">
              {(['raceToFinish', 'timedSprint'] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGameMode(mode)}
                  aria-pressed={gameMode === mode}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                    gameMode === mode
                      ? 'bg-ludiko-blue text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {t(`create.gameMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Difficulty */}
        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.difficulty')}</span>
          <div className="flex gap-2 mt-1">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`flex-1 py-2 rounded-xl font-bold transition-colors ${
                  difficulty === d
                    ? 'bg-ludiko-purple text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {t(`create.${d}`)}
              </button>
            ))}
          </div>
        </label>

        {/* Operations (math only) */}
        {showMathOptions && (
          <label className="block mb-4">
            <span className="text-sm font-semibold">{t('create.operations')}</span>
            <div className="flex gap-2 mt-1">
              {(['+', '-', '×', '÷'] as Operation[]).map((op) => (
                <button
                  key={op}
                  onClick={() => toggleOperation(op)}
                  aria-pressed={operations.includes(op)}
                  className={`flex-1 py-2 rounded-xl font-bold text-xl transition-colors ${
                    operations.includes(op)
                      ? 'bg-ludiko-green text-ludiko-text'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Rounds / Pairs + Time */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <label className="block">
            <span className="text-sm font-semibold">
              {isMemory ? t('create.pairs') : t('create.rounds')}
            </span>
            <input
              type="number"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              min={isMemory ? 4 : 5}
              max={isMemory ? 16 : 30}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">
              {gameMode === 'timedSprint' ? t('create.totalTime') : t('create.timePerRound')}
            </span>
            <input
              type="number"
              value={timePerRound}
              onChange={(e) => setTimePerRound(Number(e.target.value))}
              min={5}
              max={gameMode === 'timedSprint' ? 180 : 60}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/')}>
            {t('create.back')}
          </Button>
          <Button
            variant="green"
            size="md"
            className="flex-1"
            onClick={handleCreate}
            disabled={!name.trim() || (showMathOptions && operations.length === 0)}
          >
            {t('create.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
