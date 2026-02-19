import type { MemoryCard } from '@/utils/types';

interface MemoryBoardProps {
  cards: MemoryCard[];
  /** Indices of currently flipped (face-up) cards */
  flippedIndices: number[];
  /** Indices of matched cards */
  matchedIndices: Set<number>;
  onFlip: (index: number) => void;
  disabled: boolean;
}

/**
 * Renders the memory card grid.
 * Cards are shown face-down by default; tapping flips them.
 * Matched cards stay face-up with a green ring.
 */
export default function MemoryBoard({
  cards,
  flippedIndices,
  matchedIndices,
  onFlip,
  disabled,
}: MemoryBoardProps) {
  /* Choose grid columns based on card count */
  const cols = cards.length <= 8 ? 4 : cards.length <= 18 ? 4 : 6;

  return (
    <div
      className={`grid gap-2 w-full max-w-md mx-auto`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      role="grid"
      aria-label="Memory card grid"
    >
      {cards.map((card, i) => {
        const isFlipped = flippedIndices.includes(i);
        const isMatched = matchedIndices.has(i);
        const showFace = isFlipped || isMatched;

        return (
          <button
            key={card.id}
            onClick={() => onFlip(i)}
            disabled={disabled || isMatched || isFlipped}
            aria-label={showFace ? card.emoji : 'Hidden card'}
            className={`aspect-square rounded-xl text-3xl font-bold flex items-center justify-center
              transition-all duration-300 transform
              ${showFace ? 'rotate-y-0 scale-100' : 'bg-ludiko-purple hover:bg-ludiko-purple/80'}
              ${isMatched ? 'bg-ludiko-green/30 ring-2 ring-green-400' : showFace ? 'bg-white border-2 border-ludiko-blue' : ''}
              ${!disabled && !isMatched && !isFlipped ? 'active:scale-95 hover:scale-105 cursor-pointer' : ''}
            `}
          >
            {showFace ? (
              <span className="text-3xl sm:text-4xl">{card.emoji}</span>
            ) : (
              <span className="text-2xl text-white/60">?</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
