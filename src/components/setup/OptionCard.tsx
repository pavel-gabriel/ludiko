type Tone = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

const TONE: Record<Tone, string> = {
  pink: 'bg-ludiko-pink',
  blue: 'bg-ludiko-blue',
  green: 'bg-ludiko-green',
  yellow: 'bg-ludiko-yellow',
  purple: 'bg-ludiko-purple',
  orange: 'bg-ludiko-orange',
};

interface OptionCardProps {
  emoji: string;
  title: string;
  sub?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Icon tile colour */
  tone?: Tone;
  /** `row`: icon left, text right (full width). `tile`: icon above the text (grid cells) */
  layout?: 'row' | 'tile';
  /** Dashed outline for "open a bigger picker" cards */
  dashed?: boolean;
  testId?: string;
}

/** The big tappable choice used on every setup step: an icon tile, a short title and an optional hint */
export default function OptionCard({
  emoji,
  title,
  sub,
  selected = false,
  disabled = false,
  onClick,
  tone = 'blue',
  layout = 'row',
  dashed = false,
  testId,
}: OptionCardProps) {
  const tile = layout === 'tile';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-testid={testId}
      className={`relative w-full rounded-2xl bg-white text-left transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
        tile ? 'flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 px-2 py-3 text-center' : 'flex min-h-[4.5rem] items-center gap-3 px-3 py-3'
      } ${
        selected
          ? 'border-4 border-ludiko-purple shadow-md'
          : dashed
            ? 'border-4 border-dashed border-ludiko-blue'
            : 'border-4 border-transparent shadow'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-2xl text-3xl ${TONE[tone]} ${tile ? 'h-11 w-11' : 'h-14 w-14'}`}
      >
        {emoji}
      </span>
      <span className={`min-w-0 ${tile ? '' : 'flex-1'}`}>
        <span className={`block font-extrabold leading-tight text-ludiko-text ${tile ? 'text-sm' : 'text-lg'}`}>{title}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug text-gray-500">{sub}</span>}
      </span>
      {selected && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ludiko-purple text-sm font-extrabold text-white"
        >
          ✓
        </span>
      )}
    </button>
  );
}
