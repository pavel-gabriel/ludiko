import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore';
import { MathRacePage } from '@/components/games/MathRace';
import ShapeMatchPage from '@/components/games/ShapeMatch/ShapeMatchPage';
import MemoryGamePage from '@/components/games/MemoryGame/MemoryGamePage';

/**
 * Routes to the correct game component based on room settings.
 * Renders MathRacePage, ShapeMatchPage, or MemoryGamePage.
 */
export default function GameRouter() {
  const navigate = useNavigate();
  const { room } = useRoomStore();

  if (!room) {
    navigate('/');
    return null;
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
