import { useState } from 'react';

const EMOJI_OPTIONS = ['🦊', '🐸', '🐱', '🐶', '🐰', '🦁', '🐼', '🐨', '🦄', '🐙', '🦋', '🐝', '🐯', '🐮', '🐷', '🐵'];

interface EmojiPickerProps {
  selected: string;
  onChange: (emoji: string) => void;
  /** Avatars that are already taken and should be hidden */
  exclude?: string[];
}

export default function EmojiPicker({ selected, onChange, exclude = [] }: EmojiPickerProps) {
  const [expanded, setExpanded] = useState(true);
  const available = EMOJI_OPTIONS.filter((e) => !exclude.includes(e));

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Selected avatar: ${selected}. Click to change.`}
        aria-expanded={false}
        className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-ludiko-purple/10 hover:bg-ludiko-purple/20 transition-colors"
      >
        <span className="text-3xl" aria-hidden="true">{selected}</span>
        <span className="text-xs text-ludiko-purple font-bold" aria-hidden="true">&#9662;</span>
      </button>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-2 mt-1"
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
  );
}

export { EMOJI_OPTIONS };
