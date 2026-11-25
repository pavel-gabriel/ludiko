import type { TFunction } from 'i18next'
import type { VisualSpec } from '@/engine/types'
import { localize } from '@/engine/types'
import { clockHourLabel, groupMoney, numberLineTicks, splitMoney } from './geometry'

/** Format a number for the UI language (decimal comma in Romanian). */
export function formatNumber(n: number, lang: string): string {
  const s = String(Math.round(n * 1e6) / 1e6)
  return lang.startsWith('ro') ? s.replace('.', ',') : s
}

/** "5 lei", "50 bani", "1 leu și 50 bani" — Romanian plurals handled by i18next. */
export function moneyText(value: number, t: TFunction): string {
  const { lei, bani } = splitMoney(value)
  const parts: string[] = []
  if (lei > 0) parts.push(t('frames.visual.leu', { count: lei }))
  if (bani > 0 || lei === 0) parts.push(t('frames.visual.ban', { count: bani }))
  return parts.join(t('frames.visual.and'))
}

/**
 * Screen-reader description of a visual. Deliberately describes *what is drawn*
 * and never adds a computed answer (no totals, no "the number is 243"), so it
 * can be used inside exercises without giving the solution away.
 */
export function visualLabel(spec: VisualSpec, t: TFunction, lang: string): string {
  switch (spec.kind) {
    case 'number-line': {
      const ticks = numberLineTicks(spec.from, spec.to, spec.step ?? 1)
      const step = ticks.length > 1 ? ticks[1] - ticks[0] : (spec.step ?? 1)
      const f = (n: number) => formatNumber(n, lang)
      let label = t('frames.visual.numberLine', {
        from: f(ticks[0] ?? spec.from),
        to: f(ticks[ticks.length - 1] ?? spec.to),
        step: f(step),
      })
      if (spec.marks?.length) {
        label += '. ' + t('frames.visual.numberLineMarks', { marks: spec.marks.map(f).join(', ') })
      }
      if (spec.jumps?.length) {
        const jumps = spec.jumps
          .map((j) => t('frames.visual.jump', { from: f(j.from), to: f(j.to) }))
          .join('; ')
        label += '. ' + t('frames.visual.numberLineJumps', { jumps })
      }
      return label
    }
    case 'base10-blocks': {
      const parts: string[] = []
      if (spec.hundreds) parts.push(t('frames.visual.hundreds', { count: spec.hundreds }))
      if (spec.tens) parts.push(t('frames.visual.tens', { count: spec.tens }))
      if (spec.ones) parts.push(t('frames.visual.ones', { count: spec.ones }))
      return parts.length
        ? t('frames.visual.base10', { parts: parts.join(', ') })
        : t('frames.visual.base10Empty')
    }
    case 'clock': {
      const h = clockHourLabel(spec.hours)
      const m = ((Math.round(spec.minutes) % 60) + 60) % 60
      if (m === 0) return t('frames.visual.clockExact', { h })
      if (m === 30) return t('frames.visual.clockHalf', { h })
      return t('frames.visual.clockMinutes', { h, count: m })
    }
    case 'money': {
      const groups = groupMoney(spec.amounts)
      if (groups.length === 0) return t('frames.visual.moneyNone')
      const parts = groups
        .map((g) => t('frames.visual.moneyGroup', { count: g.count, value: moneyText(g.value, t) }))
        .join(', ')
      return t('frames.visual.money', { parts })
    }
    case 'objects': {
      const groups = spec.groups && spec.groups > 1 ? Math.floor(spec.groups) : 0
      if (!groups) return t('frames.visual.objects', { count: spec.count, icon: spec.icon })
      if (spec.count % groups === 0) {
        return t('frames.visual.objectsGroupsEven', { groups, per: spec.count / groups, icon: spec.icon })
      }
      return t('frames.visual.objectsGroupsUneven', { count: spec.count, groups, icon: spec.icon })
    }
    case 'fraction': {
      const key = spec.numerator > spec.denominator ? 'fractionWholes' : 'fraction'
      return t(`frames.visual.${key}`, { numerator: spec.numerator, denominator: spec.denominator })
    }
    case 'image':
      return localize(spec.media.alt, lang) || t('frames.visual.image')
  }
}
