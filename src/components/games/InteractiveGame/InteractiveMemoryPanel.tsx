import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemoryCard } from '@/utils/types';
import { playCorrect, playWrong } from '@/utils/sounds';

interface InteractiveMemoryPanelProps {
  cards: MemoryCard[];
  totalPairs: number;
  matchedCount: number;
  onMatchFound: () => void;
  colorAccent: 'blue' | 'pink';
}

/** Compute optimal column count for the compact split-screen grid */
function getGridCols(cardCount: number): number {
  if (cardCount <= 8) return 4;
  if (cardCount <= 12) return 4;
  if (cardCount <= 20) return 5;
  if (cardCount <= 30) return 6;
  if (cardCount <= 48) return 8;
  return 10;
}

export default function InteractiveMemoryPanel({
  cards,
  totalPairs,
  matchedCount,
  onMatchFound,
  colorAccent,
}: InteractiveMemoryPanelProps) {
  const { t } = useTranslation();
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIndices, setMatchedIndices] = useState<Set<number>>(new Set());
  const [tries, setTries] = useState(0);
  const lockRef = useRef(false);

  const bgColor = colorAccent === 'blue' ? 'bg-ludiko-blue' : 'bg-ludiko-pink';
  const cols = getGridCols(cards.length);
  const isSmall = cards.length > 16;

  const handleFlip = useCallback(
    (index: number) => {
      if (lockRef.current || matchedIndices.has(index) || flippedIndices.includes(index)) return;

      const newFlipped = [...flippedIndices, index];
      setFlippedIndices(newFlipped);

      if (newFlipped.length === 2) {
        lockRef.current = true;
        setTries((prev) => prev + 1);
        const [first, second] = newFlipped;
        const isMatch = cards[first].pairId === cards[second].pairId;

        setTimeout(() => {
          if (isMatch) {
            playCorrect();
            setMatchedIndices((prev) => {
              const next = new Set(prev);
              next.add(first);
              next.add(second);
              return next;
            });
            onMatchFound();
          } else {
            playWrong();
          }
          setFlippedIndices([]);
          lockRef.current = false;
        }, 600);
      }
    },
    [flippedIndices, matchedIndices, cards, onMatchFound],
  );

  const allMatched = matchedCount >= totalPairs;

  return (
    <div className="flex-1 flex flex-col px-0.5">
      {/* Stats row */}
      <div className="flex justify-between items-center px-1 mb-1">
        <span className="text-xs font-semibold text-gray-500">
          {t('game.matchesFound')}: {matchedCount}/{totalPairs}
        </span>
        <span className="text-xs text-gray-400">
          {t('game.tries')}: {tries}
        </span>
      </div>

      {/* Card grid */}
      {allMatched ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg font-bold text-ludiko-green">{t('game.finished')}</p>
        </div>
      ) : (
        <div
          className="grid gap-0.5 w-full mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          role="grid"
        >
          {cards.map((card, i) => {
            const isFlipped = flippedIndices.includes(i);
            const isMatched = matchedIndices.has(i);
            const showFace = isFlipped || isMatched;

            return (
              <button
                key={card.id}
                onClick={() => handleFlip(i)}
                disabled={lockRef.current || isMatched || isFlipped}
                aria-label={showFace ? card.emoji : 'Hidden card'}
                className={`aspect-square flex items-center justify-center rounded-lg transition-all duration-200
                  ${showFace ? '' : `${bgColor} hover:opacity-80`}
                  ${isMatched ? 'bg-ludiko-green/30 ring-1 ring-green-400' : showFace ? 'bg-white border border-gray-300' : ''}
                  ${!isMatched && !isFlipped ? 'active:scale-95 cursor-pointer' : ''}
                `}
              >
                {showFace ? (
                  <span className={isSmall ? 'text-sm' : 'text-lg'}>{card.emoji}</span>
                ) : (
                  <span className={`${isSmall ? 'text-xs' : 'text-sm'} text-white/60`}>?</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
