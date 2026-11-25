import { Navigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore';
import { MathRacePage } from '@/components/games/MathRace';
import ShapeMatchPage from '@/components/games/ShapeMatch/ShapeMatchPage';
import MemoryGamePage from '@/components/games/MemoryGame/MemoryGamePage';
import { isItemGame } from '@/services/itemGame';

/**
 * Routes to the correct game component based on room settings.
 * Equations, Counting and Number Sequence reuse the MathRace flow (numeric questions).
 * Rooms created with `settings.skillIds` (v2) play on items: MathRacePage (race/sprint) or the memory page.
 */
export default function GameRouter() {
  const { room } = useRoomStore();

  if (!room) {
    return <Navigate to="/" replace />;
  }

  /* Rooms with skillIds (v2) run on items: every game type but memory is the item race */
  if (isItemGame(room.settings) && room.settings.gameType !== 'memoryGame') {
    return <MathRacePage />;
  }

  switch (room.settings.gameType) {
    case 'shapeMatch':
      return <ShapeMatchPage />;
    case 'memoryGame':
      return <MemoryGamePage />;
    case 'mathRace':
    case 'equations':
    case 'countingGame':
    case 'numberSequence':
    default:
      return <MathRacePage />;
  }
}
