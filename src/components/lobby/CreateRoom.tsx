import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useRoomStore } from '@/store/roomStore';
import { buildRoom, createRoomInDB, registerDisconnectCleanup } from '@/services/roomManager';
import type { Difficulty, Operation } from '@/utils/types';
import { DEFAULT_GAME_SETTINGS } from '@/utils/constants';

export default function CreateRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setRoom, setCurrentPlayer } = useRoomStore();

  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SETTINGS.difficulty);
  const [rounds, setRounds] = useState(DEFAULT_GAME_SETTINGS.rounds);
  const [timePerRound, setTimePerRound] = useState(DEFAULT_GAME_SETTINGS.timePerRound);
  const [operations, setOperations] = useState<Operation[]>(DEFAULT_GAME_SETTINGS.operations);

  const toggleOperation = (op: Operation) => {
    setOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || operations.length === 0 || loading) return;
    setLoading(true);
    try {
      const room = buildRoom(name.trim(), { difficulty, rounds, timePerRound, operations });
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

        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.yourName')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('create.namePlaceholder')}
            className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none focus:border-ludiko-purple"
            maxLength={20}
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.difficulty')}</span>
          <div className="flex gap-2 mt-1">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
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

        <label className="block mb-4">
          <span className="text-sm font-semibold">{t('create.operations')}</span>
          <div className="flex gap-2 mt-1">
            {(['+', '-', '×', '÷'] as Operation[]).map((op) => (
              <button
                key={op}
                onClick={() => toggleOperation(op)}
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

        <div className="grid grid-cols-2 gap-4 mb-6">
          <label className="block">
            <span className="text-sm font-semibold">{t('create.rounds')}</span>
            <input
              type="number"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              min={5}
              max={30}
              className="mt-1 w-full px-4 py-2 rounded-xl border-2 border-ludiko-blue focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{t('create.timePerRound')}</span>
            <input
              type="number"
              value={timePerRound}
              onChange={(e) => setTimePerRound(Number(e.target.value))}
              min={5}
              max={60}
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
            disabled={!name.trim() || operations.length === 0}
          >
            {t('create.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
