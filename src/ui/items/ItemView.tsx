import type { Item, ItemResult } from '@/engine/types';
import ChoiceItemView from './ChoiceItemView';
import FillGapItemView from './FillGapItemView';
import MatchItemView from './MatchItemView';
import NumberInputItemView from './NumberInputItemView';
import OrderItemView from './OrderItemView';
import SortItemView from './SortItemView';
import TrueFalseItemView from './TrueFalseItemView';
import HotspotItemView from './HotspotItemView';
import ListenAndAnswerItemView from './ListenAndAnswerItemView';
import ReadAndAnswerItemView from './ReadAndAnswerItemView';
import UnsupportedItemView from './UnsupportedItemView';

export interface ItemViewProps {
  item: Item;
  /** Fires once per item, after the feedback has been shown */
  onAnswer: (result: ItemResult) => void;
  disabled?: boolean;
  /** Optional: how long the "correct" feedback shows before onAnswer fires (default 900 ms) */
  feedbackMs?: number;
}

/** Renders any item. Remounts per item id, so internal state never leaks between items. */
export default function ItemView({ item, onAnswer, disabled, feedbackMs }: ItemViewProps) {
  const common = { onAnswer, disabled, feedbackMs };
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
      return <ChoiceItemView key={item.id} item={item} {...common} />;
    case 'true-false':
      return <TrueFalseItemView key={item.id} item={item} {...common} />;
    case 'number-input':
      return <NumberInputItemView key={item.id} item={item} {...common} />;
    case 'fill-gap':
      return <FillGapItemView key={item.id} item={item} {...common} />;
    case 'order':
      return <OrderItemView key={item.id} item={item} {...common} />;
    case 'sort':
      return <SortItemView key={item.id} item={item} {...common} />;
    case 'match':
      return <MatchItemView key={item.id} item={item} {...common} />;
    case 'hotspot':
      return <HotspotItemView key={item.id} item={item} {...common} />;
    case 'read-and-answer':
      return <ReadAndAnswerItemView key={item.id} item={item} {...common} />;
    case 'listen-and-answer':
      return <ListenAndAnswerItemView key={item.id} item={item} {...common} />;
    default: {
      // Exhaustive today; kept as a safety net for item types added to the model later
      const unknown = item as Item;
      return <UnsupportedItemView key={unknown.id} item={unknown} />;
    }
  }
}
