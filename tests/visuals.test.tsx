import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n/config'
import Visual from '@/ui/visuals/Visual'
import type { VisualSpec } from '@/engine/types'
import {
  clockAngles,
  groupMoney,
  labelIndexes,
  numberLineTicks,
  polar,
  splitIntoGroups,
  tickIndexOf,
} from '@/ui/visuals/geometry'
import { resolveMediaSrc } from '@/ui/visuals/ImageVisual'
import { sampleExplanations } from '@/ui/frames/samples'
import { validateProvenance } from '@/engine/content/provenance'

const svgOf = (container: HTMLElement) => container.querySelector('svg') as SVGSVGElement

describe('clockAngles', () => {
  it('puts both hands at 12 for 12:00', () => {
    expect(clockAngles(12, 0)).toEqual({ hour: 0, minute: 0 })
  })
  it('3:00 has the hour hand at 90° and minute hand at 0°', () => {
    expect(clockAngles(3, 0)).toEqual({ hour: 90, minute: 0 })
  })
  it('moves the hour hand with the minutes (3:15 -> 97.5°, 8:30 -> 255°)', () => {
    expect(clockAngles(3, 15)).toEqual({ hour: 97.5, minute: 90 })
    expect(clockAngles(8, 30)).toEqual({ hour: 255, minute: 180 })
  })
  it('wraps 24h input and negatives', () => {
    expect(clockAngles(15, 45).hour).toBeCloseTo(112.5 + 360 - 360 + 0, 5)
    expect(clockAngles(0, 0).hour).toBe(0)
    expect(clockAngles(-1, 0).hour).toBe(330)
  })
  it('polar() measures clockwise from 12 o\'clock', () => {
    const top = polar(100, 100, 50, 0)
    expect(top.x).toBeCloseTo(100)
    expect(top.y).toBeCloseTo(50)
    const right = polar(100, 100, 50, 90)
    expect(right.x).toBeCloseTo(150)
    expect(right.y).toBeCloseTo(100)
  })
})

describe('numberLineTicks', () => {
  it('generates inclusive ticks with a step', () => {
    expect(numberLineTicks(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10])
    expect(numberLineTicks(7, 10)).toEqual([7, 8, 9, 10])
  })
  it('avoids floating point drift', () => {
    expect(numberLineTicks(0, 1, 0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
  })
  it('handles reversed ranges, bad steps and huge ranges', () => {
    expect(numberLineTicks(3, 0)).toEqual([0, 1, 2, 3])
    expect(numberLineTicks(0, 3, 0)).toEqual([0, 1, 2, 3])
    expect(numberLineTicks(0, 100000, 1).length).toBeLessThanOrEqual(200)
  })
  it('thins out labels when crowded but keeps marks and the ends', () => {
    const ticks = numberLineTicks(0, 20)
    const crowded = labelIndexes(ticks, 16, 24, 1)
    expect(crowded.size).toBeLessThan(ticks.length)
    expect(crowded.has(0)).toBe(true)
    const withMark = labelIndexes(ticks, 16, 24, 1, [13])
    expect(withMark.has(13)).toBe(true)
    expect(withMark.has(12)).toBe(false)
    expect(withMark.has(14)).toBe(false)
    const roomy = labelIndexes(numberLineTicks(0, 5), 60, 24, 1)
    expect(roomy.size).toBe(6)
  })
  it('finds tick indexes', () => {
    const ticks = numberLineTicks(0, 10, 2)
    expect(tickIndexOf(ticks, 4)).toBe(2)
    expect(tickIndexOf(ticks, 99)).toBe(-1)
  })
})

describe('layout helpers', () => {
  it('groups money by value, biggest first', () => {
    expect(groupMoney([10, 50, 10, 500])).toEqual([
      { value: 500, count: 1 },
      { value: 50, count: 1 },
      { value: 10, count: 2 },
    ])
  })
  it('splits objects into groups', () => {
    expect(splitIntoGroups(12, 3)).toEqual([4, 4, 4])
    expect(splitIntoGroups(7, 3)).toEqual([3, 2, 2])
  })
})

describe('<Visual />', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ro')
  })

  const cases: [string, VisualSpec, RegExp][] = [
    ['number-line', { kind: 'number-line', from: 0, to: 16, marks: [7, 10], jumps: [{ from: 7, to: 10 }, { from: 10, to: 15 }] }, /Axa numerelor de la 0 la 16.*7, 10.*de la 7 la 10; de la 10 la 15/ ],
    ['base10', { kind: 'base10-blocks', hundreds: 2, tens: 4, ones: 3 }, /2 sute, 4 zeci, 3 unități/],
    ['clock', { kind: 'clock', hours: 3, minutes: 15 }, /^Ceas care arată ora 3 și 15 minute$/],
    ['money', { kind: 'money', amounts: [50, 50, 500] }, /2 × 50 de bani.*1 × 5 lei|1 × 5 lei.*2 × 50 de bani/],
    ['objects', { kind: 'objects', icon: '🍎', count: 12, groups: 3 }, /3 grupuri, câte 4/],
    ['fraction', { kind: 'fraction', numerator: 3, denominator: 4 }, /3 din 4/],
    ['image', { kind: 'image', media: { kind: 'image', src: 'x.svg', alt: { ro: 'Un măr roșu', en: 'A red apple' } } }, /^Un măr roșu$/],
  ]

  it.each(cases)('%s renders an svg with a role and aria-label', (_name, spec, re) => {
    const { container } = render(<Visual spec={spec} />)
    const svg = svgOf(container)
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(re)
    expect(svg.getAttribute('viewBox')).toBeTruthy()
    expect(svg.getAttribute('width')).toBe('100%')
  })

  it('reads clock labels naturally for exact hours, half hours and 12h wrap', () => {
    const label = (h: number, m: number) =>
      svgOf(render(<Visual spec={{ kind: 'clock', hours: h, minutes: m }} />).container).getAttribute('aria-label')
    expect(label(3, 0)).toBe('Ceas care arată ora 3 fix')
    expect(label(8, 30)).toBe('Ceas care arată ora 8 și jumătate')
    expect(label(0, 1)).toBe('Ceas care arată ora 12 și 1 minut')
    expect(label(4, 20)).toBe('Ceas care arată ora 4 și 20 de minute')
  })

  it('draws the right hand angles on the clock', () => {
    const { container } = render(<Visual spec={{ kind: 'clock', hours: 3, minutes: 0 }} />)
    const lines = [...container.querySelectorAll('line')].slice(-2)
    // hour hand: points right (x increases, y stays at 100); minute hand: straight up
    const [hour, minute] = lines
    expect(Number(hour.getAttribute('x2'))).toBeGreaterThan(100)
    expect(Number(hour.getAttribute('y2'))).toBeCloseTo(100)
    expect(Number(minute.getAttribute('x2'))).toBeCloseTo(100)
    expect(Number(minute.getAttribute('y2'))).toBeLessThan(100)
  })

  it('shows all 12 numbers on the clock', () => {
    const { container } = render(<Visual spec={{ kind: 'clock', hours: 6, minutes: 0 }} />)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
  })

  it('draws one square/rect per block and the right counts', () => {
    const { container } = render(<Visual spec={{ kind: 'base10-blocks', hundreds: 1, tens: 2, ones: 3 }} />)
    // 1 flat + 2 rods + 3 cubes = 6 rects
    expect(container.querySelectorAll('rect').length).toBe(6)
    const captions = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(captions).toEqual(['1 sută', '2 zeci', '3 unități'])
  })

  it('hides numeric captions when showLabels is false', () => {
    const { container } = render(<Visual spec={{ kind: 'base10-blocks', tens: 2 }} showLabels={false} />)
    expect(container.querySelectorAll('text').length).toBe(0)
    const frac = render(<Visual spec={{ kind: 'fraction', numerator: 1, denominator: 2 }} showLabels={false} />)
    expect(frac.container.querySelectorAll('text').length).toBe(0)
  })

  it('writes the value on every coin and note', () => {
    const { container } = render(<Visual spec={{ kind: 'money', amounts: [50, 500] }} />)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toEqual(expect.arrayContaining(['50', 'bani', '5', 'lei']))
  })

  it('repeats the icon `count` times and draws group boxes', () => {
    const { container } = render(<Visual spec={{ kind: 'objects', icon: '🍎', count: 6, groups: 2 }} />)
    expect([...container.querySelectorAll('text')].filter((t) => t.textContent === '🍎').length).toBe(6)
    expect(container.querySelectorAll('rect').length).toBe(2)
  })

  it('shades `numerator` slices of the pie', () => {
    const { container } = render(<Visual spec={{ kind: 'fraction', numerator: 3, denominator: 4 }} />)
    const paths = [...container.querySelectorAll('path')]
    expect(paths.length).toBe(4)
    expect(paths.filter((p) => (p.getAttribute('fill') ?? '').includes('hatch')).length).toBe(3)
  })

  it('speaks English when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    const { container } = render(<Visual spec={{ kind: 'clock', hours: 3, minutes: 15 }} />)
    expect(svgOf(container).getAttribute('aria-label')).toBe('Clock showing 15 minutes past 3')
    const img = render(<Visual spec={{ kind: 'image', media: { kind: 'image', src: 'x.svg', alt: { ro: 'Un măr', en: 'An apple' } } }} />)
    expect(svgOf(img.container).getAttribute('aria-label')).toBe('An apple')
    await i18n.changeLanguage('ro')
  })

  it('never fetches remote images', () => {
    expect(resolveMediaSrc('https://evil.example/x.png')).toBeNull()
    expect(resolveMediaSrc('//evil.example/x.png')).toBeNull()
    expect(resolveMediaSrc('media/x.svg', '/ludiko/')).toBe('/ludiko/media/x.svg')
    expect(resolveMediaSrc('/media/x.svg', '/ludiko/')).toBe('/ludiko/media/x.svg')
    const { container } = render(<Visual spec={{ kind: 'image', media: { kind: 'image', src: 'https://evil.example/x.png', alt: { ro: 'x' } } }} />)
    expect(container.querySelector('image')).toBeNull()
  })

  it('survives odd specs without throwing', () => {
    const odd: VisualSpec[] = [
      { kind: 'base10-blocks' },
      { kind: 'money', amounts: [] },
      { kind: 'objects', icon: '⭐', count: 0 },
      { kind: 'fraction', numerator: 0, denominator: 0 },
      { kind: 'number-line', from: 5, to: 5 },
    ]
    for (const spec of odd) {
      const { container } = render(<Visual spec={spec} />)
      expect(svgOf(container)).toBeTruthy()
    }
  })
})

describe('sample explanations', () => {
  it('have valid provenance and 3–4 frames each', () => {
    expect(sampleExplanations).toHaveLength(4)
    for (const e of sampleExplanations) {
      expect(validateProvenance(e.provenance)).toEqual([])
      expect(e.provenance).toMatchObject({ source: 'own', licence: 'OWN', author: 'Ludiko' })
      expect(e.reviewStatus).toBe('beta')
      expect(e.frames.length).toBeGreaterThanOrEqual(3)
      expect(e.frames.length).toBeLessThanOrEqual(4)
      for (const f of e.frames) {
        expect(f.text.ro.length).toBeGreaterThan(0)
        expect(f.text.en?.length).toBeGreaterThan(0)
        expect(f.visual).toBeTruthy()
      }
    }
  })
})
