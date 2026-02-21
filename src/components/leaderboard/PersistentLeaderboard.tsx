import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchRecentHistory,
  computeLeaderboard,
  type LeaderboardEntry,
} from '@/services/historyService';

/**
 * Persistent leaderboard that shows all-time stats from Firestore.
 * Displayed on the home page below the main buttons.
 */
export default function PersistentLeaderboard() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentHistory(50)
      .then((history) => {
        setEntries(computeLeaderboard(history));
      })
      .catch(() => {
        /* Firestore may not be accessible (rules, offline, etc.) */
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="w-full max-w-md mt-6" role="region" aria-label={t('game.leaderboard')}>
      <h3 className="text-sm font-semibold text-gray-500 mb-3 text-center">
        {t('game.leaderboard')}
      </h3>
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
              {entry.avgAccuracy}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
