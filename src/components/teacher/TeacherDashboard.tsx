import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import CloseButton from '@/components/ui/CloseButton';
import { useAuthStore } from '@/store/authStore';
import { logOut } from '@/services/authService';
import {
  getTeacherSessions,
  deleteSession,
} from '@/services/teacherService';
import type { ClassroomSession } from '@/utils/types';

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid, teacherProfile, loading: authLoading, reset } = useAuthStore();
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!uid) { navigate('/teacher/login'); return; }
    getTeacherSessions(uid).then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, [uid, authLoading]);

  const handleLogout = async () => {
    await logOut();
    reset();
    navigate('/teacher/login');
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const statusColor = (status: ClassroomSession['status']) => {
    if (status === 'active') return 'bg-ludiko-green text-green-800';
    if (status === 'finished') return 'bg-gray-200 text-gray-600';
    return 'bg-ludiko-yellow text-yellow-800';
  };

  return (
    <div className="page">
      <div className="card w-full max-w-lg relative" role="main">
        <CloseButton />
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">{t('teacher.dashboard')}</h2>
            <p className="text-sm text-gray-500">
              {teacherProfile?.displayName || t('teacher.teacher')}
            </p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-orange-400 hover:bg-orange-500 flex items-center justify-center transition-colors shadow-sm"
          aria-label={t('teacher.logout')}
          title={t('teacher.logout')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>

        {/* Actions */}
        <div className="flex gap-3 mb-3">
          <Button
            variant="pink"
            size="md"
            className="flex-1"
            onClick={() => navigate('/teacher/session/new')}
          >
            {t('teacher.newSession')}
          </Button>
          <Button
            variant="blue"
            size="md"
            className="flex-1"
            onClick={() => navigate('/teacher/templates')}
          >
            {t('teacher.templates')}
          </Button>
        </div>
        <div className="mb-6">
          <Button
            variant="purple"
            size="md"
            className="w-full"
            onClick={() => navigate('/interactive')}
          >
            {t('interactive.button')}
          </Button>
        </div>

        {/* Session list */}
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          {t('teacher.sessions')}
        </h3>

        {loading ? (
          <p className="text-center text-gray-400 py-4">{t('teacher.loading')}</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-gray-400 py-4">{t('teacher.noSessions')}</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{session.title}</p>
                  <p className="text-xs text-gray-500">
                    {session.studentCodes.length} {t('teacher.students')} &middot;{' '}
                    {t(`create.gameType${session.settings.gameType.charAt(0).toUpperCase() + session.settings.gameType.slice(1)}`)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold ${statusColor(session.status)}`}>
                  {t(`teacher.status.${session.status}`)}
                </span>
                <div className="flex gap-1">
                  {session.status === 'draft' && (
                    <Button
                      variant="green"
                      size="sm"
                      onClick={() => navigate(`/teacher/session/${session.id}`)}
                    >
                      {t('teacher.open')}
                    </Button>
                  )}
                  {session.status === 'active' && (
                    <Button
                      variant="blue"
                      size="sm"
                      onClick={() => navigate(`/teacher/live/${session.id}`)}
                    >
                      {t('teacher.monitor')}
                    </Button>
                  )}
                  {session.status === 'finished' && (
                    <Button
                      variant="purple"
                      size="sm"
                      onClick={() => navigate(`/teacher/results/${session.id}`)}
                    >
                      {t('teacher.results')}
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="text-red-400 hover:text-red-600 px-2 text-sm font-bold"
                    title={t('teacher.delete')}
                    aria-label={`${t('teacher.delete')} ${session.title}`}
                  >
                    &times;
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
