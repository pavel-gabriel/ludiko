import type { SkillState } from '@/engine/types'

/** How a skill state looks in the teacher's heatmap: colour AND a glyph AND a text label (never colour alone) */
export const STATE_LOOK: Record<SkillState, { glyph: string; cell: string; chip: string }> = {
  unknown: { glyph: '·', cell: 'bg-gray-100 text-gray-500', chip: 'bg-gray-100 text-gray-700' },
  gap: { glyph: '!', cell: 'bg-red-200 text-red-900 font-extrabold', chip: 'bg-red-200 text-red-900' },
  learning: { glyph: '↑', cell: 'bg-amber-200 text-amber-900', chip: 'bg-amber-200 text-amber-900' },
  practised: { glyph: '✓', cell: 'bg-sky-200 text-sky-900', chip: 'bg-sky-200 text-sky-900' },
  mastered: { glyph: '★', cell: 'bg-green-300 text-green-900', chip: 'bg-green-300 text-green-900' },
}

export const STATE_ORDER: readonly SkillState[] = ['gap', 'learning', 'practised', 'mastered', 'unknown']
