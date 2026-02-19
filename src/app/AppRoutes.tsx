import { Routes, Route } from 'react-router-dom';
import HomePage from '@/components/lobby/HomePage';
import CreateRoom from '@/components/lobby/CreateRoom';
import JoinRoom from '@/components/lobby/JoinRoom';
import LobbyPage from '@/components/lobby/LobbyPage';
import { MathRacePage } from '@/components/games/MathRace';

/** All application routes — add new pages here */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/game" element={<MathRacePage />} />
    </Routes>
  );
}
