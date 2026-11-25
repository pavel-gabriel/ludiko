import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import HomePage from '@/components/lobby/HomePage';
import RouteFallback from '@/components/ui/RouteFallback';

/*
 * Code-splitting: every route except the home page is lazy-loaded so the
 * initial bundle stays small (budget: docs/PLAN.md §10, checked by
 * `npm run check:size`). To add a route use:
 *   const MyPage = lazy(() => import('@/components/.../MyPage'));
 * (default export; import the file directly, not a barrel index).
 */
const SinglePlayerPage = lazy(() => import('@/components/lobby/SinglePlayerPage'));
const MultiplayerPage = lazy(() => import('@/components/lobby/MultiplayerPage'));
const SettingsPage = lazy(() => import('@/components/lobby/SettingsPage'));
const CreditsPage = lazy(() => import('@/components/lobby/CreditsPage'));
const CreateRoom = lazy(() => import('@/components/lobby/CreateRoom'));
const JoinRoom = lazy(() => import('@/components/lobby/JoinRoom'));
const LobbyPage = lazy(() => import('@/components/lobby/LobbyPage'));
const GameRouter = lazy(() => import('@/components/games/GameRouter'));
const InteractiveSetupPage = lazy(() => import('@/components/lobby/InteractiveSetupPage'));
const InteractiveGamePage = lazy(
  () => import('@/components/games/InteractiveGame/InteractiveGamePage'),
);
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard'));
const TeacherLogin = lazy(() => import('@/components/teacher/TeacherLogin'));
const TeacherDashboard = lazy(() => import('@/components/teacher/TeacherDashboard'));
const SessionConfig = lazy(() => import('@/components/teacher/SessionConfig'));
const SessionDetail = lazy(() => import('@/components/teacher/SessionDetail'));
const TeacherLiveDashboard = lazy(() => import('@/components/teacher/TeacherLiveDashboard'));
const SessionResults = lazy(() => import('@/components/teacher/SessionResults'));
const TemplatesPage = lazy(() => import('@/components/teacher/TemplatesPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** All application routes — add new pages here */
export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Player routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/singleplayer" element={<SinglePlayerPage />} />
          <Route path="/multiplayer" element={<MultiplayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/interactive" element={<InteractiveSetupPage />} />
          <Route path="/game" element={<GameRouter />} />
          <Route path="/game/interactive" element={<InteractiveGamePage />} />

          {/* Admin route — PIN-protected, owner only */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Teacher routes */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/session/new" element={<SessionConfig />} />
          <Route path="/teacher/session/:sessionId/edit" element={<SessionConfig />} />
          <Route path="/teacher/session/:sessionId" element={<SessionDetail />} />
          <Route path="/teacher/live/:sessionId" element={<TeacherLiveDashboard />} />
          <Route path="/teacher/results/:sessionId" element={<SessionResults />} />
          <Route path="/teacher/templates" element={<TemplatesPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
