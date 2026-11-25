/**
 * Pure helpers for the shape and ruler visuals (no React, easy to unit-test).
 */

export interface Pt {
  x: number
  y: number
}

export type PolyShape = 'triangle' | 'square' | 'rectangle'

/** Keep a width:height ratio readable: very long or very thin rectangles are eased to these limits. */
export const MIN_ASPECT = 0.5
export const MAX_ASPECT = 2.4

export function clampAspect(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio))
}

/** Pixel size of a rectangle with width:height = `ratio` (clamped) that fits in maxW x maxH. */
export function fitRect(ratio: number, maxW: number, maxH: number): { w: number; h: number } {
  const r = clampAspect(ratio)
  const w = Math.min(maxW, maxH * r)
  return { w, h: w / r }
}

/**
 * Triangle with side lengths [base, right, left] -> three points (base-left, base-right, apex),
 * scaled to fit and centred in a maxW x maxH box. Falls back to an isosceles triangle when the
 * lengths are missing, impossible (triangle inequality) or would be a flat sliver.
 */
export function trianglePoints(sides: number[] | undefined, maxW: number, maxH: number): [Pt, Pt, Pt] {
  let raw: [Pt, Pt, Pt] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0.85 }]
  if (sides && sides.length === 3 && sides.every((s) => Number.isFinite(s) && s > 0)) {
    const [a, b, c] = sides
    const d = (a * a + c * c - b * b) / (2 * a)
    const h2 = c * c - d * d
    if (h2 > 0) {
      const h = Math.sqrt(h2)
      if (h / Math.max(a, b, c) >= 0.3) raw = [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: d, y: h }]
    }
  }
  const xs = raw.map((p) => p.x)
  const minX = Math.min(...xs)
  const spanX = Math.max(...xs) - minX
  const spanY = raw[2].y
  const k = Math.min(maxW / spanX, maxH / spanY)
  const offX = (maxW - spanX * k) / 2
  const offY = (maxH - spanY * k) / 2
  // SVG y grows downwards: the apex is at the top
  return raw.map((p) => ({ x: offX + (p.x - minX) * k, y: offY + (spanY - p.y) * k })) as [Pt, Pt, Pt]
}

/**
 * Value written next to each drawn side (triangle: base, right, left; square/rectangle: top, right,
 * bottom, left), expanded from the spec's `sides` (square 1 value = all four; rectangle 2 values =
 * length, width, length, width). null when no labels should be drawn.
 */
export function drawnSideValues(shape: PolyShape, sides: number[] | undefined): number[] | null {
  if (!sides || sides.length === 0) return null
  if (shape === 'triangle') return sides.length === 3 ? sides.slice() : null
  if (shape === 'square') {
    if (sides.length === 1) return [sides[0], sides[0], sides[0], sides[0]]
    return sides.length === 4 ? sides.slice() : null
  }
  if (sides.length === 2) return [sides[0], sides[1], sides[0], sides[1]]
  return sides.length === 4 ? sides.slice() : null
}

/** Drawn-side indexes that show "?" for `hideSide` (an index into the spec's `sides`). */
export function hiddenDrawnSides(shape: PolyShape, sidesLen: number, hideSide: number | undefined): Set<number> {
  const out = new Set<number>()
  if (hideSide === undefined || !Number.isInteger(hideSide) || hideSide < 0 || hideSide >= sidesLen) return out
  if (shape === 'triangle') out.add(hideSide)
  else if (shape === 'square') (sidesLen === 1 ? [0, 1, 2, 3] : [hideSide]).forEach((i) => out.add(i))
  else (sidesLen === 2 ? [hideSide, hideSide + 2] : [hideSide]).forEach((i) => out.add(i))
  return out
}

/** Number of values `sides` must have for a shape (circle: none). */
export const SIDE_COUNTS: Record<'triangle' | 'square' | 'rectangle' | 'circle', number[]> = {
  triangle: [3],
  square: [1, 4],
  rectangle: [2, 4],
  circle: [],
}

/** Rectangle proportions from the spec's sides (length:width), or a default when unknown. */
export function rectRatio(shape: 'square' | 'rectangle', sides: number[] | undefined): number {
  if (shape === 'square' || !sides || sides.length < 2) return shape === 'square' ? 1 : 1.5
  return sides[0] / sides[1]
}

const STRIDES = [1, 2, 5, 10, 20, 50, 100]

/** Smallest "nice" label stride so number labels are at least `minPx` apart. */
export function rulerLabelStride(to: number, pxPerUnit: number, minPx = 20): number {
  for (const s of STRIDES) if (s * pxPerUnit >= minPx) return Math.min(s, Math.max(1, to))
  return 100
}
