const EMOJI_OPTIONS = ['🦊', '🐸', '🐱', '🐶', '🐰', '🦁', '🐼', '🐨', '🦄', '🐙', '🦋', '🐝', '🐯', '🐮', '🐷', '🐵'];

interface EmojiPickerProps {
  selected: string;
  onChange: (emoji: string) => void;
  /** Avatars that are already taken and should be hidden */
  exclude?: string[];
}

export default function EmojiPicker({ selected, onChange, exclude = [] }: EmojiPickerProps) {
  const available = EMOJI_OPTIONS.filter((e) => !exclude.includes(e));

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {available.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
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
