import { useTranslation } from 'react-i18next';
import { localize, type Item } from '@/engine/types';

/** Placeholder for item types whose renderer is not built yet (hotspot, read-and-answer, listen-and-answer). Never calls onAnswer. */
export default function UnsupportedItemView({ item }: { item: Item }) {
  const { t, i18n } = useTranslation();
  return (
    <section
      className="mx-auto w-full max-w-md rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 text-center"
      data-item-type={item.type}
      data-unsupported="true"
    >
      <p className="text-lg font-bold text-ludiko-text">{localize(item.prompt, i18n.language)}</p>
      <p className="mt-2 text-sm font-semibold text-gray-500" role="note">
        <span aria-hidden="true">🛠️ </span>
        {t('items.unsupported')}
      </p>
    </section>
  );
}
