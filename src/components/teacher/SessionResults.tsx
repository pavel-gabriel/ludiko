import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import {
  getSession,
  getSessionResults,
  exportResultsToCSV,
  downloadCSV,
} from '@/services/teacherService';
import type { ClassroomSession, StudentSessionResult } from '@/utils/types';

export default function SessionResults() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { uid } = useAuthStore();
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [results, setResults] = useState<StudentSessionResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !sessionId) { navigate('/teacher/login'); return; }
    Promise.all([
      getSession(sessionId),
      getSessionResults(sessionId),
    ]).then(([s, r]) => {
      if (!s) { navigate('/teacher'); return; }
      setSession(s);
      setResults(r);
      setLoading(false);
    });
  }, [uid, sessionId]);

  const handleExport = () => {
    if (!session) return;
    const csv = exportResultsToCSV(session.title, results);
    downloadCSV(`${session.title.replace(/\s+/g, '_')}_results.csv`, csv);
  };

  if (loading || !session) {
    return (
      <div className="page">
        <p className="text-gray-400">{t('teacher.loading')}</p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy || b.score - a.score);
  const avgAccuracy = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length)
    : 0;

  return (
    <div className="page">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-2 text-center">{session.title}</h2>
        <p className="text-sm text-center text-gray-500 mb-4">
          {t('teacher.results')} &middot; {results.length} {t('teacher.students')}
        </p>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-ludiko-green/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{avgAccuracy}%</p>
            <p className="text-xs text-gray-500">{t('teacher.avgAccuracy')}</p>
          </div>
          <div className="bg-ludiko-blue/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{results.length}</p>
            <p className="text-xs text-gray-500">{t('teacher.students')}</p>
          </div>
          <div className="bg-ludiko-yellow/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">
              {results.filter((r) => r.accuracy >= 80).length}
            </p>
            <p className="text-xs text-gray-500">{t('teacher.passed')}</p>
          </div>
        </div>

        {/* Results table */}
        {sorted.length === 0 ? (
          <p className="text-center text-gray-400 py-4">{t('teacher.noResults')}</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
            {sorted.map((result, i) => (
              <div
                key={result.studentCode}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2"
              >
                <span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {result.studentCode}
                    <span className="text-gray-400 font-normal ml-1">
                      ({result.studentLabel})
                    </span>
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {result.score}/{result.totalQuestions}
                </span>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold ${
                  result.accuracy >= 80
                    ? 'bg-ludiko-green text-green-800'
                    : result.accuracy >= 50
                      ? 'bg-ludiko-yellow text-yellow-800'
                      : 'bg-red-100 text-red-700'
                }`}>
                  {result.accuracy}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="orange" size="md" onClick={() => navigate('/teacher')}>
            {t('teacher.back')}
          </Button>
          <Button variant="green" size="md" className="flex-1" onClick={handleExport}>
            {t('teacher.exportCSV')}
          </Button>
        </div>
      </div>
    </div>
  );
}
