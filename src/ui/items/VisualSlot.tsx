import Visual from '@/ui/visuals/Visual';
import type { VisualSpec } from '@/engine/types';

/**
 * Renders a VisualSpec inside an item (prompt visual or a card/option).
 * Captions that state the number ("3/4", "2 sute") are hidden, because inside a
 * question the visual usually IS what the child has to work out.
 */
export interface VisualSlotProps {
  spec: VisualSpec;
  className?: string;
  /** Cards/options use a smaller drawing than the prompt visual */
  size?: 'sm' | 'md' | 'lg';
}

export default function VisualSlot({ spec, className = '', size = 'md' }: VisualSlotProps) {
  return <Visual spec={spec} size={size} showLabels={false} className={className} />;
}
