import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, buildPlayer, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import type { Difficulty, Operation, GameType, ShapeMode } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS, GAME_TYPES } from '@/utils/constants';
import EmojiPicker, { EMOJI_OPTIONS } from '@/components/ui/EmojiPicker';

export default function InteractiveSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  /* Player 1 */
  const [name1, setName1] = useState('');
  const [avatar1, setAvatar1] = useState(EMOJI_OPTIONS[0]);

  /* Player 2 */
  const [name2, setName2] = useState('');
  const [avatar2, setAvatar2] = useState(EMOJI_OPTIONS[1]);

  /* Game settings */
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

  const isMath = gameType === 'mathRace';
  const isShapeMatch = gameType === 'shapeMatch';
  const isMemory = gameType === 'memoryGame';

  const handleStart = async () => {
    if (!name1.trim() || !name2.trim() || loading) return;
    if (isMath && operations.length === 0) return;
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      const room = buildRoom(name1.trim(), {
        gameType,
        gameMode: 'raceToFinish',
        difficulty,
        operations: isMath ? operations : ['+'],
        rounds,
        timePerRound,
        ...(isShapeMatch && { shapeMode }),
      }, avatar1);

      /* Add player 2 to the room */
      const player2 = buildPlayer(name2.trim(), 1, avatar2);
      player2.isReady = true;
      room.players.push(player2);
      room.status = 'playing';

      await createRoomInDB(room);
      registerDisconnectCleanup(room.id, true);
      setRoom(room);
      setCurrentPlayer(room.players[0]);
      navigate('/game/interactive');
    } finally {
      setLoading(false);
    }
  };

  const canStart =
    name1.trim() &&
    name2.trim() &&
    avatar1 !== avatar2 &&
    (!isMath || operations.length > 0);

  return (
    <div className="page">
      <div className="card w-full max-w-md relative" role="main">
        <CloseButton />
        <h2 className="text-2xl font-bold mb-6 text-center">{t('interactive.title')}</h2>

        {/* Player 1 */}
        <div className="border border-gray-200 rounded-xl p-3 mb-4" role="group" aria-label={t('interactive.player1')}>
          <h3 className="text-sm font-bold text-ludiko-purple mb-2">{t('interactive.player1')}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
            <label className="block flex-1 min-w-[60%]">
              <span className="text-sm font-semibold">{t('create.yourName')}</span>
              <input
                type="text"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                placeholder={t('create.namePlaceholder')}
                className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
                maxLength={20}
              />
            </label>
            <EmojiPicker selected={avatar1} onChange={setAvatar1} exclude={[avatar2]} />
          </div>
        </div>

        {/* Player 2 */}
        <div className="border border-gray-200 rounded-xl p-3 mb-4" role="group" aria-label={t('interactive.player2')}>
          <h3 className="text-sm font-bold text-ludiko-pink mb-2">{t('interactive.player2')}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
            <label className="block flex-1 min-w-[60%]">
              <span className="text-sm font-semibold">{t('create.yourName')}</span>
              <input
                type="text"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                placeholder={t('create.namePlaceholder')}
                className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-pink focus:outline-none focus:border-ludiko-purple"
                maxLength={20}
              />
            </label>
            <EmojiPicker selected={avatar2} onChange={setAvatar2} exclude={[avatar1]} />
          </div>
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

        {/* Shape mode toggle */}
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
        {isMath && (
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

        {/* Difficulty (math & shape only) */}
        {!isMemory && (
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
        )}

        {/* Rounds + Time */}
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

        {avatar1 === avatar2 && (
          <p className="text-xs text-red-500 mb-2 text-center" role="alert" aria-live="polite">
            {t('interactive.differentAvatars')}
          </p>
        )}

        <Button
          variant="green"
          size="lg"
          className="w-full"
          onClick={handleStart}
          disabled={!canStart || loading}
        >
          {t('home.play')}
        </Button>
      </div>
    </div>
  );
}
