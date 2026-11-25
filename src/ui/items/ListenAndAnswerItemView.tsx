import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, type ListenAndAnswerItem } from '@/engine/types';
import { resolveMediaSrc } from '@/ui/visuals/ImageVisual';
import ItemShell, { CardFace } from './ItemShell';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/** Audio prompt for pre-readers: a big play button (replay allowed), then option cards */
export default function ListenAndAnswerItemView({
  item,
  onAnswer,
  disabled,
  feedbackMs,
}: ItemRendererProps<ListenAndAnswerItem>) {
  const { t, i18n } = useTranslation();
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const locked = disabled || result !== null;
  const selectedId = result && 'selectedId' in result.response ? result.response.selectedId : null;
  const correct = item.options.find((o) => o.id === item.correctId);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [played, setPlayed] = useState(false);
  const href = resolveMediaSrc(item.audio.src);
  const canPlay = href !== null && typeof Audio !== 'undefined';

  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  };
  // Never keep playing into the next item
  useEffect(() => stop, []);

  const play = () => {
    if (!canPlay || !href) {
      setFailed(true);
      return;
    }
    stop();
    try {
      const a = new Audio(href);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.onerror = () => {
        setPlaying(false);
        setFailed(true);
      };
      setFailed(false);
      setPlayed(true);
      setPlaying(true);
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          setPlaying(false);
          setFailed(true);
        });
      }
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  };

  const wide = item.options.some(
    (o) => !o.visual && (localize(o.text, i18n.language).length > 14 || item.options.length > 4),
  );

  return (
    <ItemShell
      item={item}
      result={result}
      onContinue={proceed}
      hideAudio
      correctAnswer={correct ? <CardFace card={correct} /> : null}
    >
      <div className="mb-4 flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={play}
          disabled={!canPlay}
          aria-label={played ? t('items.replay') : t('items.listen')}
          className="flex min-h-[88px] min-w-[88px] flex-col items-center justify-center rounded-full bg-ludiko-blue px-6 py-3 text-ludiko-text shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true" className={`text-4xl ${playing ? 'animate-pulse' : ''}`}>
            🔊
          </span>
          <span aria-hidden="true" className="text-sm font-extrabold">
            {playing ? t('items.playing') : played ? t('items.replay') : t('items.listen')}
          </span>
        </button>
        {failed && (
          <p role="status" className="text-center text-sm font-semibold text-gray-600">
            {t('items.audioFailed')}
          </p>
        )}
      </div>

      <div className={`grid gap-3 ${wide ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {item.options.map((option) => {
          const isCorrect = result !== null && option.id === item.correctId;
          const isWrongPick = result !== null && !result.correct && option.id === selectedId;
          const style = isCorrect
            ? 'border-green-500 bg-green-100 text-green-900 ring-2 ring-green-500'
            : isWrongPick
              ? 'border-amber-400 border-dashed bg-amber-50 text-amber-900'
              : result !== null
                ? 'border-gray-200 bg-gray-50 text-gray-400'
                : 'border-ludiko-blue bg-white text-ludiko-text hover:bg-ludiko-blue/10 active:bg-ludiko-blue/20';
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => {
                stop();
                submit({ type: 'listen-and-answer', selectedId: option.id });
              }}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-xl font-extrabold transition-all active:scale-95 disabled:cursor-default ${style}`}
            >
              <CardFace card={option} />
              {isCorrect && (
                <span className="text-sm font-bold">
                  <span aria-hidden="true">✓ </span>
                  {t('items.correctMark')}
                </span>
              )}
              {isWrongPick && <span className="text-sm font-bold">{t('items.yourChoice')}</span>}
            </button>
          );
        })}
      </div>
    </ItemShell>
  );
}
