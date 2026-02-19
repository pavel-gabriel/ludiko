import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '@/components/lobby/HomePage';
import CreateRoom from '@/components/lobby/CreateRoom';
import JoinRoom from '@/components/lobby/JoinRoom';
import LobbyPage from '@/components/lobby/LobbyPage';

export default function App() {
  return (
    <BrowserRouter basename="/ludiko">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/lobby" element={<LobbyPage />} />
      </Routes>
    </BrowserRouter>
  );
}
