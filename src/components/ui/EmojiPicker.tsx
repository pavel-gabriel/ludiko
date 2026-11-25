import { useState } from 'react';

const EMOJI_OPTIONS = ['🦊', '🐸', '🐱', '🐶', '🐰', '🦁', '🐼', '🐨', '🦄', '🐙', '🦋', '🐝', '🐯', '🐮', '🐷', '🐵'];

interface EmojiPickerProps {
  selected: string;
  onChange: (emoji: string) => void;
  /** Avatars that are already taken and should be hidden */
  exclude?: string[];
}

/**
 * Collapsed-by-default avatar picker.
 *
 * Returns a React Fragment with two siblings:
 *   1. A compact trigger button (always rendered)
 *   2. A full-width emoji grid (only when expanded)
 *
 * Place inside a `flex flex-wrap` container so the trigger sits
 * inline with other elements while the grid wraps to the next line.
 */
export default function EmojiPicker({ selected, onChange, exclude = [] }: EmojiPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const available = EMOJI_OPTIONS.filter((e) => !exclude.includes(e));

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-label={`Selected avatar: ${selected}. Click to change.`}
        aria-expanded={expanded}
        className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-ludiko-purple/10 hover:bg-ludiko-purple/20 transition-colors"
      >
        <span className="text-3xl" aria-hidden="true">{selected}</span>
        <span className="text-xs text-ludiko-purple font-bold" aria-hidden="true">
          {expanded ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {expanded && (
        <div
          className="flex flex-wrap gap-2 w-full"
          role="listbox"
          aria-label="Choose an avatar"
        >
          {available.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={selected === emoji}
              aria-label={emoji}
              onClick={() => { onChange(emoji); setExpanded(false); }}
              className={`w-10 h-10 text-xl rounded-xl flex items-center justify-center transition-all
                ${selected === emoji
                  ? 'bg-ludiko-purple/20 ring-2 ring-ludiko-purple scale-110'
                  : 'bg-gray-50 hover:bg-gray-100 hover:scale-105'
                }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export { EMOJI_OPTIONS };
