import { Routes, Route } from 'react-router-dom';
import HomePage from '@/components/lobby/HomePage';
import SinglePlayerPage from '@/components/lobby/SinglePlayerPage';
import MultiplayerPage from '@/components/lobby/MultiplayerPage';
import SettingsPage from '@/components/lobby/SettingsPage';
import CreateRoom from '@/components/lobby/CreateRoom';
import JoinRoom from '@/components/lobby/JoinRoom';
import LobbyPage from '@/components/lobby/LobbyPage';
import GameRouter from '@/components/games/GameRouter';
import InteractiveSetupPage from '@/components/lobby/InteractiveSetupPage';
import { InteractiveGamePage } from '@/components/games/InteractiveGame';
import {
  TeacherLogin,
  TeacherDashboard,
  SessionConfig,
  SessionDetail,
  TeacherLiveDashboard,
  SessionResults,
  TemplatesPage,
} from '@/components/teacher';
import AdminDashboard from '@/components/admin/AdminDashboard';

/** All application routes — add new pages here */
export default function AppRoutes() {
  return (
    <Routes>
      {/* Player routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/singleplayer" element={<SinglePlayerPage />} />
      <Route path="/multiplayer" element={<MultiplayerPage />} />
      <Route path="/settings" element={<SettingsPage />} />
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
  );
}
