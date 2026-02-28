import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchRecentHistory,
  computeLeaderboard,
  type LeaderboardEntry,
  type GameHistoryEntry,
} from '@/services/historyService';
import type { GameType } from '@/utils/types';
import { GAME_TYPES } from '@/utils/constants';

interface PersistentLeaderboardProps {
  onClose: () => void;
}

/**
 * Persistent leaderboard shown as a modal overlay.
 * Supports filtering by game type via dropdown.
 */
export default function PersistentLeaderboard({ onClose }: PersistentLeaderboardProps) {
  const { t } = useTranslation();
  const [allHistory, setAllHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<GameType | 'all'>('all');

  useEffect(() => {
    fetchRecentHistory(50)
      .then((history) => setAllHistory(history))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const entries: LeaderboardEntry[] = useMemo(() => {
    const filtered = filterType === 'all'
      ? allHistory
      : allHistory.filter((h) => h.gameType === filterType);
    return computeLeaderboard(filtered);
  }, [allHistory, filterType]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('game.leaderboard')}
    >
      {/* Panel — stop click from bubbling to backdrop */}
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm"
          aria-label="Close leaderboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="text-lg font-bold text-center mb-3">{t('game.leaderboard')}</h3>

        {/* Game type filter */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterType === 'all'
                  ? 'bg-ludiko-purple text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('leaderboard.all')}
            </button>
            {GAME_TYPES.map(({ type, emoji, labelKey }) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterType === type
                    ? 'bg-ludiko-purple text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {emoji} {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('teacher.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">{t('leaderboard.noData')}</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto" aria-label={t('game.leaderboard')}>
            {entries.slice(0, 10).map((entry, index) => (
              <li
                key={`${entry.name}::${entry.avatar}`}
                className={`flex items-center gap-3 rounded-xl px-4 py-2 ${
                  index === 0
                    ? 'bg-ludiko-yellow/40 ring-1 ring-ludiko-yellow'
                    : 'bg-gray-50'
                }`}
              >
                <span className="text-sm font-bold text-gray-400 w-5">{index + 1}</span>
                <span className="text-xl">{entry.avatar}</span>
                <span className="font-bold flex-1 text-sm truncate">{entry.name}</span>
                <span className="text-xs font-semibold text-ludiko-purple">{entry.wins}W</span>
                <span className="text-xs text-gray-500">{entry.totalGames} {t('leaderboard.played')}</span>
                <span className="text-xs text-gray-400">{entry.avgAccuracy}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
