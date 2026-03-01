import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import type { Difficulty, Operation, GameType, ShapeMode } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS, GAME_TYPES } from '@/utils/constants';
import EmojiPicker, { EMOJI_OPTIONS } from '@/components/ui/EmojiPicker';

export default function SinglePlayerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)]);
  const [gameType, setGameType] = useState<GameType>(DEFAULT_GAME_SETTINGS.gameType);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SETTINGS.difficulty);
  const [rounds, setRounds] = useState(DEFAULT_GAME_SETTINGS.rounds);
  const [timePerRound, setTimePerRound] = useState(DEFAULT_GAME_SETTINGS.timePerRound);
  const [operations, setOperations] = useState<Operation[]>(DEFAULT_GAME_SETTINGS.operations);
  const [shapeMode, setShapeMode] = useState<ShapeMode>('image');
  const [loading, setLoading] = useState(false);

  const toggleOperation = (op: Operation) => {
    setOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  const showMathOptions = gameType === 'mathRace';
  const isShapeMatch = gameType === 'shapeMatch';
  const isMemory = gameType === 'memoryGame';

  const handlePlay = async () => {
    if (!name.trim() || loading) return;
    if (showMathOptions && operations.length === 0) return;
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      const room = buildRoom(name.trim(), {
        gameType,
        gameMode: 'raceToFinish',
        difficulty,
        operations: showMathOptions ? operations : ['+'],
        rounds,
        timePerRound,
        ...(isShapeMatch && { shapeMode }),
      }, avatar);
      room.status = 'playing';
      await createRoomInDB(room);
      registerDisconnectCleanup(room.id, true);
      setRoom(room);
      setCurrentPlayer(room.players[0]);
      navigate('/game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-md relative">
        <CloseButton />
        <h2 className="text-2xl font-bold mb-6 text-center">{t('home.singlePlayer')}</h2>

        {/* Name */}
        <label className="block mb-2">
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

        {/* Avatar picker */}
        <div className="mb-4">
          <span className="text-sm font-semibold">{t('create.avatar')}</span>
          <EmojiPicker selected={avatar} onChange={setAvatar} />
        </div>

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

        {/* Shape mode toggle (Shape Match only) */}
        {isShapeMatch && (
          <label className="block mb-4">
            <span className="text-sm font-semibold">{t('create.shapeMode')}</span>
            <div className="flex gap-2 mt-1">
              {(['image', 'word'] as ShapeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setShapeMode(mode)}
                  aria-pressed={shapeMode === mode}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                    shapeMode === mode
                      ? 'bg-ludiko-green text-ludiko-text'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {t(`create.shapeMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </label>
        )}

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

        {/* Rounds / Pairs + Time */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <label className="block">
            <span className="text-sm font-semibold">
              {isMemory ? t('create.pairs') : t('create.rounds')}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={rounds}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setRounds(isNaN(v) ? 0 : v);
              }}
              onBlur={() => {
                const min = isMemory ? 3 : 5;
                const max = isMemory ? 50 : 30;
                if (!rounds || rounds < min) setRounds(min);
                else if (rounds > max) setRounds(max);
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">
              {isMemory ? t('create.totalTime') : t('create.timePerRound')}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={timePerRound}
              onChange={(e) => {
                const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setTimePerRound(isNaN(v) ? 0 : v);
              }}
              onBlur={() => {
                const max = isMemory ? 300 : 60;
                if (!timePerRound || timePerRound < 5) setTimePerRound(5);
                else if (timePerRound > max) setTimePerRound(max);
              }}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
        </div>

        <Button
          variant="green"
          size="lg"
          className="w-full"
          onClick={handlePlay}
          disabled={!name.trim() || (showMathOptions && operations.length === 0) || loading}
        >
          {t('home.play')}
        </Button>
      </div>
    </div>
  );
}
