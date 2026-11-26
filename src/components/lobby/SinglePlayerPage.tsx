import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import { ensureAnonymousAuth } from '@/services/authService';
import type { Difficulty, Operation, GameType, ShapeMode } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS, usesOperations } from '@/utils/constants';
import GameTypePicker from '@/components/ui/GameTypePicker';
import SkillPicker from '@/components/play/SkillPicker';
import PlayModePicker from '@/components/play/PlayModePicker';
import { effectiveGameType, skillSettings } from '@/components/play/presets';
import { skillUsable, type ItemGameKind } from '@/services/itemGame';
import { resolveSkillNames } from '@/components/play/skillNames';
import AnimalNamePicker from '@/components/ui/AnimalNamePicker';
import { identityAvatar, identityName, randomIdentity } from '@/utils/animalNames';

export default function SinglePlayerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  /* The child picks an animal name (no free text): the animal is also the avatar */
  const [identity, setIdentity] = useState(() => randomIdentity());
  const [gameType, setGameType] = useState<GameType>(DEFAULT_GAME_SETTINGS.gameType);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SETTINGS.difficulty);
  const [rounds, setRounds] = useState(DEFAULT_GAME_SETTINGS.rounds);
  const [timePerRound, setTimePerRound] = useState(DEFAULT_GAME_SETTINGS.timePerRound);
  const [operations, setOperations] = useState<Operation[]>(DEFAULT_GAME_SETTINGS.operations);
  const [shapeMode, setShapeMode] = useState<ShapeMode>('image');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleOperation = (op: Operation) => {
    setOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  /** With skills chosen the room runs on items: the game type only picks race vs memory */
  const itemMode = skillIds.length > 0;
  const roomGameType = effectiveGameType(skillIds, gameType);
  const showMathOptions = !itemMode && usesOperations(gameType);
  const isShapeMatch = !itemMode && gameType === 'shapeMatch';
  const isMemory = roomGameType === 'memoryGame';
  const itemKind: ItemGameKind = isMemory ? 'memory' : 'race';
  const unplayable = itemMode ? skillIds.filter((id) => !skillUsable(id, itemKind)) : [];

  const handlePlay = async () => {
    if (loading || unplayable.length > 0) return;
    if (showMathOptions && operations.length === 0) return;
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      const room = buildRoom(identityName(identity, i18n.language), {
        gameType: roomGameType,
        gameMode: 'raceToFinish',
        difficulty,
        operations: showMathOptions ? operations : ['+'],
        rounds,
        timePerRound,
        ...(isShapeMatch && { shapeMode }),
        ...skillSettings(skillIds),
      }, identityAvatar(identity));
      room.status = 'playing';
      await createRoomInDB(room);
      registerDisconnectCleanup(room.id, true, undefined, room.code);
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

        {/* Animal name + avatar (no free-text name) */}
        <AnimalNamePicker value={identity} onChange={setIdentity} />

        {/* What to practise (v2: skills from the registry) */}
        <SkillPicker value={skillIds} onChange={setSkillIds} kind={itemKind} />

        {/* Game type selector (v1) or, with skills chosen, just the mode */}
        <div className="block mb-4">
          {itemMode ? (
            <PlayModePicker value={gameType} onChange={setGameType} />
          ) : (
            <>
              <span className="text-sm font-semibold">{t('create.gameType')}</span>
              <GameTypePicker value={gameType} onChange={setGameType} />
            </>
          )}
        </div>

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

        {unplayable.length > 0 && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {t('play.unplayable', { names: resolveSkillNames(unplayable, i18n.language) })}
          </p>
        )}

        <Button
          variant="green"
          size="lg"
          className="w-full"
          onClick={handlePlay}
          disabled={(showMathOptions && operations.length === 0) || loading || unplayable.length > 0}
        >
          {t('home.play')}
        </Button>
      </div>
    </div>
  );
}
