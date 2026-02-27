import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchRecentHistory,
  computeLeaderboard,
  type LeaderboardEntry,
  type GameHistoryEntry,
} from '@/services/historyService';
import type { GameType } from '@/utils/types';
import { GAME_TYPES } from '@/utils/constants';

/**
 * Persistent leaderboard that shows all-time stats from Firestore.
 * Displayed on the home page when the trophy button is clicked.
 * Supports filtering by game type and shows play count.
 */
export default function PersistentLeaderboard() {
  const { t } = useTranslation();
  const [allHistory, setAllHistory] = useState<GameHistoryEntry[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameType | 'all'>('all');

  useEffect(() => {
    fetchRecentHistory(50)
      .then((history) => {
        setAllHistory(history);
        setEntries(computeLeaderboard(history));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (allHistory.length === 0) return;
    const filtered = filter === 'all'
      ? allHistory
      : allHistory.filter((h) => h.gameType === filter);
    setEntries(computeLeaderboard(filtered));
  }, [filter, allHistory]);

  if (loading) {
    return (
      <div className="w-full max-w-md mt-6 text-center">
        <p className="text-sm text-gray-400">{t('teacher.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mt-6" role="region" aria-label={t('game.leaderboard')}>
      <h3 className="text-sm font-semibold text-gray-500 mb-3 text-center">
        {t('game.leaderboard')}
      </h3>

      {/* Game type filter */}
      <div className="flex gap-1 mb-3 justify-center flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
            filter === 'all'
              ? 'bg-ludiko-purple/20 text-ludiko-text ring-1 ring-ludiko-purple'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
          }`}
        >
          {t('leaderboard.all')}
        </button>
        {GAME_TYPES.map(({ type, emoji, labelKey }) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              filter === type
                ? 'bg-ludiko-purple/20 text-ludiko-text ring-1 ring-ludiko-purple'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
            }`}
          >
            {emoji} {t(labelKey)}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-4">{t('leaderboard.noData')}</p>
      ) : (
        <ul className="space-y-2">
          {entries.slice(0, 10).map((entry, index) => (
            <li
              key={`${entry.name}::${entry.avatar}`}
              className={`flex items-center gap-3 rounded-xl px-4 py-2 ${
                index === 0
                  ? 'bg-ludiko-yellow/40 ring-1 ring-ludiko-yellow'
                  : 'bg-white/80'
              }`}
            >
              <span className="text-sm font-bold text-gray-400 w-5">
                {index + 1}
              </span>
              <span className="text-xl">{entry.avatar}</span>
              <span className="font-bold flex-1 text-sm truncate">{entry.name}</span>
              <span className="text-xs font-semibold text-ludiko-purple">
                {entry.wins}W
              </span>
              <span className="text-xs text-gray-500">
                {entry.totalGames} {t('leaderboard.played')}
              </span>
              <span className="text-xs text-gray-400">
                {entry.avgAccuracy}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
