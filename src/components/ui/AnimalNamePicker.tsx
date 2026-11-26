import { useTranslation } from 'react-i18next';
import EmojiPicker from '@/components/ui/EmojiPicker';
import {
  identityAvatar,
  identityName,
  identityWithAvatar,
  shuffleIdentity,
  type AnimalIdentity,
} from '@/utils/animalNames';

interface AnimalNamePickerProps {
  value: AnimalIdentity;
  onChange: (next: AnimalIdentity) => void;
  /** Avatars (animals) that are taken in the room / by the other player: hidden and avoided by the shuffle */
  exclude?: string[];
  /** Visible label, e.g. "Player 1"; falls back to the generic one */
  label?: string;
  /** Border accent of the name box */
  accent?: 'blue' | 'pink';
  /** Wrapper classes (default: bottom margin) */
  className?: string;
}

/**
 * Children never type a name in a room: this shows a picked "animal name" (e.g. "Vulpea Veselă"), a
 * shuffle button for a new one, and the avatar grid. Choosing another animal changes the noun of the
 * name, so avatar and name always match. There is deliberately no text input here.
 */
export default function AnimalNamePicker({ value, onChange, exclude = [], label, accent = 'blue', className = 'mb-4' }: AnimalNamePickerProps) {
  const { t, i18n } = useTranslation();
  const name = identityName(value, i18n.language);

  return (
    <div className={className}>
      <span className="text-sm font-semibold">{label ?? t('rooms.yourName')}</span>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <EmojiPicker
          selected={identityAvatar(value)}
          onChange={(emoji) => onChange(identityWithAvatar(value, emoji))}
          exclude={exclude}
          gridClassName="order-last"
        />
        <p
          data-testid="animal-name"
          aria-live="polite"
          className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 font-bold text-lg leading-tight break-words ${
            accent === 'pink' ? 'border-ludiko-pink' : 'border-ludiko-blue'
          }`}
        >
          {name}
        </p>
        <button
          type="button"
          onClick={() => onChange(shuffleIdentity(value, exclude))}
          aria-label={t('rooms.shuffle')}
          title={t('rooms.shuffle')}
          className="shrink-0 w-11 h-11 rounded-xl bg-ludiko-yellow hover:bg-yellow-200 text-2xl flex items-center justify-center transition-colors"
        >
          <span aria-hidden="true">🎲</span>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">{t('rooms.hint')}</p>
    </div>
  );
}
