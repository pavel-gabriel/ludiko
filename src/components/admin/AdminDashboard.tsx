import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { verifyAdminPin, getAdminStats } from '@/services/adminService';
import type { AdminStats } from '@/services/adminService';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Human-readable game type label */
function gameTypeLabel(key: string): string {
  const map: Record<string, string> = {
    mathRace: 'Math Race',
    shapeMatch: 'Shape Match',
    memoryGame: 'Memory Game',
    unknown: 'Unknown',
  };
  return map[key] ?? key;
}

/** Format a Unix ms timestamp as a locale date string */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Stat card sub-component                                            */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 ${color} flex flex-col gap-1`}
      role="region"
      aria-label={`${label}: ${value}`}
    >
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-sm font-medium opacity-80">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PIN gate                                                           */
/* ------------------------------------------------------------------ */

interface PinGateProps {
  onSuccess: () => void;
}

function PinGate({ onSuccess }: PinGateProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPin(pin)) {
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="page">
      <div className="card w-full max-w-xs text-center relative" role="main">
        <CloseButton />
        <h1 className="text-2xl font-bold mb-2">{t('admin.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('admin.pinPrompt')}</p>

        <form onSubmit={handleSubmit} aria-label={t('admin.pinFormLabel')}>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            placeholder={t('admin.pinPlaceholder')}
            className="input-field w-full text-center text-xl tracking-widest mb-3"
            aria-label={t('admin.pinLabel')}
            autoComplete="current-password"
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-sm mb-3" role="alert" aria-live="assertive">
              {t('admin.pinError')}
            </p>
          )}
          <Button variant="purple" size="md" className="w-full" type="submit">
            {t('admin.enter')}
          </Button>
        </form>

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  /* Fetch stats once PIN is verified */
  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    getAdminStats()
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [unlocked]);

  /* Show PIN gate until unlocked */
  if (!unlocked) {
    return <PinGate onSuccess={() => setUnlocked(true)} />;
  }

  return (
    <div className="page">
      <div className="card w-full max-w-2xl relative" role="main">
        <CloseButton />
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.subtitle')}</p>
        </div>

        {loading && (
          <p className="text-center text-gray-400 py-8" aria-live="polite">
            {t('admin.loading')}
          </p>
        )}

        {error && (
          <p className="text-center text-red-400 py-8" role="alert" aria-live="assertive">
            {t('admin.loadError')}
          </p>
        )}

        {stats && (
          <>
            {/* Summary stat cards */}
            <section aria-label={t('admin.overviewSection')} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                {t('admin.overviewSection')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  label={t('admin.totalTeachers')}
                  value={stats.totalTeachers}
                  color="bg-ludiko-purple text-purple-800"
                />
                <StatCard
                  label={t('admin.totalSessions')}
                  value={stats.totalSessions}
                  color="bg-ludiko-blue text-blue-800"
                />
                <StatCard
                  label={t('admin.totalStudentResults')}
                  value={stats.totalStudentResults}
                  color="bg-ludiko-green text-green-800"
                />
                <StatCard
                  label={t('admin.activeSessions')}
                  value={stats.activeSessions}
                  color="bg-ludiko-yellow text-yellow-800"
                />
                <StatCard
                  label={t('admin.finishedSessions')}
                  value={stats.finishedSessions}
                  color="bg-gray-100 text-gray-700"
                />
                <StatCard
                  label={t('admin.draftSessions')}
                  value={stats.draftSessions}
                  color="bg-ludiko-pink text-pink-800"
                />
              </div>
            </section>

            {/* Sessions by game type */}
            <section aria-label={t('admin.byGameTypeSection')} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                {t('admin.byGameTypeSection')}
              </h2>
              {Object.keys(stats.sessionsByGameType).length === 0 ? (
                <p className="text-gray-400 text-sm">{t('admin.noData')}</p>
              ) : (
                <ul className="space-y-2" aria-label={t('admin.byGameTypeSection')}>
                  {Object.entries(stats.sessionsByGameType).map(([type, count]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2"
                    >
                      <span className="font-medium">{gameTypeLabel(type)}</span>
                      <span className="text-sm font-bold text-gray-700">
                        {count} {t('admin.sessions')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent sessions */}
            <section aria-label={t('admin.recentSessionsSection')}>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                {t('admin.recentSessionsSection')}
              </h2>
              {stats.recentSessions.length === 0 ? (
                <p className="text-gray-400 text-sm">{t('admin.noData')}</p>
              ) : (
                <ul className="space-y-2" aria-label={t('admin.recentSessionsSection')}>
                  {stats.recentSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{s.title}</p>
                        <p className="text-xs text-gray-500">
                          {gameTypeLabel(s.gameType)} &middot; {s.studentCount}{' '}
                          {t('admin.students')} &middot; {formatDate(s.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg font-bold ${
                          s.status === 'active'
                            ? 'bg-ludiko-green text-green-800'
                            : s.status === 'finished'
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-ludiko-yellow text-yellow-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
