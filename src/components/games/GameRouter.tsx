import { Navigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore';
import { MathRacePage } from '@/components/games/MathRace';
import ShapeMatchPage from '@/components/games/ShapeMatch/ShapeMatchPage';
import MemoryGamePage from '@/components/games/MemoryGame/MemoryGamePage';

/**
 * Routes to the correct game component based on room settings.
 * Renders MathRacePage, ShapeMatchPage, or MemoryGamePage.
 */
export default function GameRouter() {
  const { room } = useRoomStore();

  if (!room) {
    return <Navigate to="/" replace />;
  }

  switch (room.settings.gameType) {
    case 'shapeMatch':
      return <ShapeMatchPage />;
    case 'memoryGame':
      return <MemoryGamePage />;
    case 'mathRace':
    default:
      return <MathRacePage />;
  }
}
