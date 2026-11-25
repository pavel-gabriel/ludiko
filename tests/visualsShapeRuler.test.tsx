import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n/config'
import Visual from '@/ui/visuals/Visual'
import { visualLabel } from '@/ui/visuals/labels'
import type { VisualSpec } from '@/engine/types'
import { validateVisual } from '@/engine/content/validate'
import {
  clampAspect,
  drawnSideValues,
  fitRect,
  hiddenDrawnSides,
  MAX_ASPECT,
  MIN_ASPECT,
  rectRatio,
  rulerLabelStride,
  trianglePoints,
} from '@/ui/visuals/shapeGeometry'
import { generateItems } from '@/engine/items/generators'
import { getSkillsBySubject } from '@/engine/content/registry'
import type { Skill } from '@/engine/types'

const generate = (id: string, n: number) => generateItems(getSkillsBySubject('mat').find((s) => s.id === id) as Skill, n, { seed: 5 })

const svgOf = (c: HTMLElement) => c.querySelector('svg') as SVGSVGElement

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

describe('shape geometry helpers', () => {
  it('keeps rectangle aspect within limits', () => {
    expect(clampAspect(0.1)).toBe(MIN_ASPECT)
    expect(clampAspect(20)).toBe(MAX_ASPECT)
    expect(clampAspect(1.5)).toBe(1.5)
    expect(clampAspect(NaN)).toBe(1)
    const wide = fitRect(12 / 2, 200, 120)
    expect(wide.w / wide.h).toBeCloseTo(MAX_ASPECT)
    expect(wide.w).toBeLessThanOrEqual(200)
    const tall = fitRect(1 / 10, 200, 120)
    expect(tall.h).toBeLessThanOrEqual(120)
    expect(tall.w / tall.h).toBeCloseTo(MIN_ASPECT)
  })
  it('is proportional for moderate ratios', () => {
    const a = fitRect(7 / 3, 200, 120)
    expect(a.w / a.h).toBeCloseTo(7 / 3)
    expect(rectRatio('rectangle', [7, 3])).toBeCloseTo(7 / 3)
    expect(rectRatio('square', [5])).toBe(1)
    expect(rectRatio('rectangle', undefined)).toBe(1.5)
  })
  it('draws triangles with the given side lengths (3-4-5 is a right triangle) and falls back when impossible', () => {
    const [p0, p1, p2] = trianglePoints([4, 5, 3], 200, 120)
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
    const base = dist(p0, p1)
    expect(dist(p1, p2) / base).toBeCloseTo(5 / 4, 3)
    expect(dist(p2, p0) / base).toBeCloseTo(3 / 4, 3)
    for (const pts of [trianglePoints([1, 1, 5], 200, 120), trianglePoints(undefined, 200, 120)]) {
      expect(pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
  })
  it('expands sides to the drawn sides and maps hideSide', () => {
    expect(drawnSideValues('square', [5])).toEqual([5, 5, 5, 5])
    expect(drawnSideValues('rectangle', [7, 3])).toEqual([7, 3, 7, 3])
    expect(drawnSideValues('rectangle', [7, 3, 7])).toBeNull()
    expect(drawnSideValues('triangle', undefined)).toBeNull()
    expect([...hiddenDrawnSides('rectangle', 2, 1)]).toEqual([1, 3])
    expect([...hiddenDrawnSides('triangle', 3, 2)]).toEqual([2])
    expect(hiddenDrawnSides('triangle', 3, 7).size).toBe(0)
  })
  it('ruler labels never crowd', () => {
    expect(rulerLabelStride(10, 32)).toBe(1)
    expect(rulerLabelStride(30, 10.8)).toBe(2)
    expect(rulerLabelStride(100, 3.2)).toBe(10)
  })
})

describe('Shape and Ruler render', () => {
  it('renders a labelled rectangle', () => {
    const { container } = render(<Visual spec={{ kind: 'shape', shape: 'rectangle', sides: [7, 3], unit: 'cm' }} />)
    const texts = [...svgOf(container).querySelectorAll('text')].map((t) => t.textContent)
    expect(texts.filter((t) => t === '7 cm')).toHaveLength(2)
    expect(texts.filter((t) => t === '3 cm')).toHaveLength(2)
    expect(svgOf(container).getAttribute('aria-label')).toBe('Dreptunghi cu laturile 7 cm, 3 cm')
  })
  it('shows "?" for the hidden side and does not leak it in text or label', () => {
    const spec: VisualSpec = { kind: 'shape', shape: 'triangle', sides: [4, 5, 9], unit: 'cm', hideSide: 2 }
    const { container } = render(<Visual spec={spec} />)
    const svg = svgOf(container)
    expect(svg.querySelectorAll('[data-testid="side-unknown"]')).toHaveLength(1)
    expect(svg.textContent).toContain('?')
    expect(svg.textContent).not.toContain('9')
    const label = svg.getAttribute('aria-label')!
    expect(label).not.toContain('9')
    expect(label).toContain('necunoscută')
    expect(label).toContain('4 cm')
  })
  it('square with one hidden value hides all four labels; circle has no sides', () => {
    const sq = render(<Visual spec={{ kind: 'shape', shape: 'square', sides: [6], unit: 'm', hideSide: 0 }} />)
    expect(svgOf(sq.container).querySelectorAll('[data-testid="side-unknown"]')).toHaveLength(4)
    expect(svgOf(sq.container).getAttribute('aria-label')).not.toContain('6')
    const c = render(<Visual spec={{ kind: 'shape', shape: 'circle' }} />)
    expect(svgOf(c.container).querySelectorAll('text')).toHaveLength(0)
    expect(svgOf(c.container).querySelector('circle')).toBeTruthy()
  })
  it('renders a ruler with a neutral label and an object bar', () => {
    const spec: VisualSpec = { kind: 'ruler', to: 15, unit: 'cm', objectEnd: 7, objectLabel: { ro: 'Creionul', en: 'The pencil' } }
    const { container } = render(<Visual spec={spec} />)
    const svg = svgOf(container)
    const label = svg.getAttribute('aria-label')!
    expect(label).toContain('Riglă de la 0 la 15 cm')
    expect(label).toContain('obiect pe riglă')
    expect(label).toContain('Creionul')
    expect(label).not.toMatch(/\b7\b/)
    expect(svg.textContent).toContain('Creionul')
    expect(svg.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2)
  })
  it('has English labels', async () => {
    await i18n.changeLanguage('en')
    const t = i18n.t.bind(i18n)
    expect(visualLabel({ kind: 'shape', shape: 'square', sides: [5], unit: 'cm' }, t, 'en')).toBe('Square with side 5 cm')
    expect(visualLabel({ kind: 'ruler', to: 10, unit: 'cm' }, t, 'en')).toBe('Ruler from 0 to 10 cm')
    await i18n.changeLanguage('ro')
  })
})

describe('validateVisual shape/ruler', () => {
  const ok = (v: unknown) => expect(validateVisual(v, 'v')).toEqual([])
  const bad = (v: unknown, re: RegExp) => expect(validateVisual(v, 'v').join('\n')).toMatch(re)
  it('accepts valid specs', () => {
    ok({ kind: 'shape', shape: 'circle' })
    ok({ kind: 'shape', shape: 'triangle', sides: [3, 4, 5], unit: 'cm', hideSide: 1 })
    ok({ kind: 'shape', shape: 'square', sides: [4] })
    ok({ kind: 'shape', shape: 'square', sides: [4, 4, 4, 4] })
    ok({ kind: 'shape', shape: 'rectangle', sides: [7, 3] })
    ok({ kind: 'shape', shape: 'rectangle', sides: [7, 3, 7, 3], hideSide: 3 })
    ok({ kind: 'ruler', to: 10, unit: 'cm' })
    ok({ kind: 'ruler', to: 100, unit: 'cm', from: 3, objectEnd: 100, objectLabel: { ro: 'x' } })
  })
  it('rejects bad shapes', () => {
    bad({ kind: 'shape', shape: 'hexagon' }, /"shape" must be one of/)
    bad({ kind: 'shape', shape: 'triangle', sides: [3, 4] }, /needs 3 side/)
    bad({ kind: 'shape', shape: 'rectangle', sides: [3] }, /needs 2 or 4/)
    bad({ kind: 'shape', shape: 'square', sides: [3, 3] }, /needs 1 or 4/)
    bad({ kind: 'shape', shape: 'circle', sides: [3] }, /circle has no/)
    bad({ kind: 'shape', shape: 'square', sides: [0] }, /positive numbers/)
    bad({ kind: 'shape', shape: 'square', sides: [-2] }, /positive numbers/)
    bad({ kind: 'shape', shape: 'triangle', sides: [3, 4, 5], hideSide: 3 }, /hideSide/)
    bad({ kind: 'shape', shape: 'triangle', hideSide: 0 }, /hideSide/)
    bad({ kind: 'shape', shape: 'square', sides: [3], extra: 1 }, /unknown field/)
  })
  it('rejects bad rulers', () => {
    bad({ kind: 'ruler', to: 0, unit: 'cm' }, /"to"/)
    bad({ kind: 'ruler', to: 101, unit: 'cm' }, /"to"/)
    bad({ kind: 'ruler', to: 10, unit: 'mm' }, /"unit"/)
    bad({ kind: 'ruler', to: 10, unit: 'cm', from: 5, objectEnd: 5 }, /less than "objectEnd"/)
    bad({ kind: 'ruler', to: 10, unit: 'cm', objectEnd: 11 }, /not exceed/)
    bad({ kind: 'ruler', to: 10, unit: 'cm', from: 2 }, /needs "objectEnd"/)
  })
})

describe('generated measures items use the new visuals', () => {
  it('perimeter items carry a valid shape visual; missing-side items hide a side', () => {
    const items = generate('mat.geom.perimeter', 200)
    const shapes = items.filter((i) => i.visual?.kind === 'shape')
    expect(shapes.length).toBeGreaterThan(items.length * 0.8)
    expect(items.some((i) => i.visual?.kind === 'shape' && i.visual.hideSide !== undefined)).toBe(true)
    for (const i of items) if (i.visual) expect(validateVisual(i.visual, i.id)).toEqual([])
  })
  it('length items use a ruler', () => {
    const items = generate('mat.length.cm', 200)
    expect(items.some((i) => i.visual?.kind === 'ruler')).toBe(true)
    for (const i of items) if (i.visual) expect(validateVisual(i.visual, i.id)).toEqual([])
  })
})
