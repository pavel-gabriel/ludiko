import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisualSpec } from '@/engine/types'
import { localize } from '@/engine/types'
import NumberLine from './NumberLine'
import Base10Blocks from './Base10Blocks'
import Clock from './Clock'
import Money from './Money'
import Objects from './Objects'
import FractionVisual from './FractionVisual'
import ImageVisual from './ImageVisual'
import { visualLabel } from './labels'

export type VisualSize = 'sm' | 'md' | 'lg'

export interface VisualProps {
  spec: VisualSpec
  size?: VisualSize
  /**
   * Draw helper text that states a number (fraction "3/4", "2 sute" captions).
   * Item renderers pass `false` when the visual IS the question. Default true.
   */
  showLabels?: boolean
  className?: string
}

const MAX_WIDTH: Record<VisualSize, number> = { sm: 240, md: 340, lg: 460 }
/** Compact visuals (round clock, single pie) look huge at full width. */
const COMPACT_KINDS: VisualSpec['kind'][] = ['clock', 'fraction']

/** Renders any VisualSpec as a responsive, accessible SVG. */
export default function Visual({ spec, size = 'md', showLabels = true, className = '' }: VisualProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'ro'
  const label = visualLabel(spec, t, lang)
  const maxWidth = Math.round(MAX_WIDTH[size] * (COMPACT_KINDS.includes(spec.kind) ? 0.7 : 1))

  let svg: ReactElement
  switch (spec.kind) {
    case 'number-line':
      svg = <NumberLine from={spec.from} to={spec.to} step={spec.step} marks={spec.marks} jumps={spec.jumps} label={label} lang={lang} />
      break
    case 'base10-blocks':
      svg = <Base10Blocks hundreds={spec.hundreds} tens={spec.tens} ones={spec.ones} label={label} t={t} showCounts={showLabels} />
      break
    case 'clock':
      svg = <Clock hours={spec.hours} minutes={spec.minutes} label={label} />
      break
    case 'money':
      svg = <Money amounts={spec.amounts} label={label} />
      break
    case 'objects':
      svg = (
        <Objects icon={spec.icon} count={spec.count} groups={spec.groups} label={label}
          /* Small (answer-card) visuals never enlarge icons, so options stay comparable */
          maxScale={size === 'sm' ? 1 : undefined} />
      )
      break
    case 'fraction':
      svg = <FractionVisual numerator={spec.numerator} denominator={spec.denominator} shape={spec.shape} label={label} showText={showLabels} />
      break
    case 'image':
      svg = <ImageVisual src={spec.media.src} alt={localize(spec.media.alt, lang)} label={label} />
      break
    /* TEMPORARY text fallback until the shape/ruler SVG components land */
    case 'shape':
    case 'ruler':
      svg = <p role="img" aria-label={label} className="text-center font-bold">{label}</p>
      break
  }

  return (
    <div className={`mx-auto w-full ${className}`} style={{ maxWidth }} data-visual={spec.kind}>
      {svg}
    </div>
  )
}
