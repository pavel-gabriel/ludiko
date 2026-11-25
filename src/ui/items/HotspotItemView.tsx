import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, type HotspotItem } from '@/engine/types';
import { resolveMediaSrc } from '@/ui/visuals/ImageVisual';
import ItemShell from './ItemShell';
import { useItemAnswer, type ItemRendererProps } from './useItemAnswer';

/** Tap the right circular region of an image. Regions are real buttons: Tab / arrows move, Enter / Space answer. */
export default function HotspotItemView({ item, onAnswer, disabled, feedbackMs }: ItemRendererProps<HotspotItem>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { result, submit, proceed } = useItemAnswer(item, onAnswer, feedbackMs);
  const locked = disabled || result !== null;
  const selectedId = result && 'selectedId' in result.response ? result.response.selectedId : null;
  const [imgFailed, setImgFailed] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const src = resolveMediaSrc(item.image.src);
  const alt = localize(item.image.alt, lang);

  const label = (i: number) => {
    const l = localize(item.regions[i].label, lang);
    return l || t('items.zone', { n: i + 1 });
  };
  const correctIndex = item.regions.findIndex((r) => r.id === item.correctId);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!locked) submit({ type: 'hotspot', selectedId: id });
      return;
    }
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const n = item.regions.length;
    buttons.current[(i + step + n) % n]?.focus();
  };

  return (
    <ItemShell
      item={item}
      result={result}
      onContinue={proceed}
      hint={t('items.hotspotHint')}
      correctAnswer={correctIndex >= 0 ? label(correctIndex) : null}
    >
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl border-2 border-gray-200 bg-ludiko-bg"
        role="group"
        aria-label={alt}
      >
        {src && !imgFailed ? (
          <img
            src={src}
            alt={alt}
            draggable={false}
            onError={() => setImgFailed(true)}
            className="block h-auto w-full select-none"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-ludiko-yellow/40 p-4 text-center text-sm font-semibold text-gray-600">
            {alt}
          </div>
        )}
        {item.regions.map((region, i) => {
          const isCorrect = result !== null && region.id === item.correctId;
          const isWrongPick = result !== null && !result.correct && region.id === selectedId;
          const style = isCorrect
            ? 'border-green-600 bg-green-300/60 text-green-900'
            : isWrongPick
              ? 'border-amber-500 border-dashed bg-amber-200/60 text-amber-900'
              : result !== null
                ? 'border-gray-400 bg-white/30 text-gray-500'
                : 'border-ludiko-text/70 bg-white/40 text-ludiko-text hover:bg-white/70 active:bg-white/80';
          return (
            <button
              key={region.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              disabled={locked}
              aria-label={label(i)}
              onClick={() => submit({ type: 'hotspot', selectedId: region.id })}
              onKeyDown={(e) => onKeyDown(e, i, region.id)}
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.r * 2}%`,
                minWidth: 48,
                minHeight: 48,
              }}
              className={`absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-dashed text-base font-extrabold shadow transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-ludiko-pink focus-visible:ring-offset-2 disabled:cursor-default ${style}`}
            >
              <span aria-hidden="true">{isCorrect ? '✓' : i + 1}</span>
            </button>
          );
        })}
      </div>
    </ItemShell>
  );
}
