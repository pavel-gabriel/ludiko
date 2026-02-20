import type { MemoryCard } from '@/utils/types';

interface MemoryBoardProps {
  cards: MemoryCard[];
  flippedIndices: number[];
  matchedIndices: Set<number>;
  onFlip: (index: number) => void;
  disabled: boolean;
}

/** Compute optimal column count based on total cards */
function getGridCols(cardCount: number): number {
  if (cardCount <= 8) return 4;
  if (cardCount <= 12) return 4;
  if (cardCount <= 20) return 5;
  if (cardCount <= 30) return 6;
  if (cardCount <= 48) return 8;
  return 10;
}

/** Compute emoji size class based on card count */
function getEmojiSize(cardCount: number): string {
  if (cardCount <= 12) return 'text-3xl sm:text-4xl';
  if (cardCount <= 24) return 'text-2xl sm:text-3xl';
  if (cardCount <= 48) return 'text-xl sm:text-2xl';
  return 'text-lg sm:text-xl';
}

export default function MemoryBoard({
  cards,
  flippedIndices,
  matchedIndices,
  onFlip,
  disabled,
}: MemoryBoardProps) {
  const cols = getGridCols(cards.length);
  const emojiSize = getEmojiSize(cards.length);
  const isLarge = cards.length > 24;

  return (
    <div
      className="grid gap-1.5 w-full"
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
            className={`aspect-square font-bold flex items-center justify-center
              transition-all duration-300 transform
              ${isLarge ? 'rounded-lg' : 'rounded-xl'}
              ${showFace ? 'rotate-y-0 scale-100' : 'bg-ludiko-purple hover:bg-ludiko-purple/80'}
              ${isMatched ? 'bg-ludiko-green/30 ring-2 ring-green-400' : showFace ? 'bg-white border-2 border-ludiko-blue' : ''}
              ${!disabled && !isMatched && !isFlipped ? 'active:scale-95 hover:scale-105 cursor-pointer' : ''}
            `}
          >
            {showFace ? (
              <span className={emojiSize}>{card.emoji}</span>
            ) : (
              <span className={`${isLarge ? 'text-lg' : 'text-2xl'} text-white/60`}>?</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
