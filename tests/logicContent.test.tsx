import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { render } from '@testing-library/react'
import i18n from '@/i18n/config'
import Visual from '@/ui/visuals/Visual'
import { visualLabel } from '@/ui/visuals/labels'
import { validateExplanation, validateItem, validateSkillGraph, validateSkills, validateVisual } from '@/engine/content/validate'
import { validateProvenance } from '@/engine/content/provenance'
import { getAllSkills, getExplanation, getSkillsBySubject } from '@/engine/content/registry'
import { checkResponse } from '@/engine/items/check'
import { generateItems } from '@/engine/items/generators'
import { buildNumberSequence, PATTERN_UNITS } from '@/engine/items/generators/logicPatterns'
import { ODD_SETS, groupOf } from '@/engine/items/generators/logicOddOne'
import { ANALOGIES } from '@/engine/items/generators/logicAnalogy'
import { isValidSudoku4, possibleDigits, randomSolution } from '@/engine/items/generators/logicSudoku'
import { MOVE_ARROWS, MOVE_DELTA, type Move } from '@/engine/items/generators/logicRobot'
import { buildWhere, permutations, satisfies } from '@/engine/items/generators/logicWhere'
import { mulberry32 } from '@/engine/items/generators/util'
import { LEARN_SUBJECTS, SUBJECT_EMOJI } from '@/ui/learn/subjects'
import ro from '@/i18n/ro.json'
import en from '@/i18n/en.json'
import type { ChoiceItem, Item, NumberInputItem, Skill, VisualSpec } from '@/engine/types'

const ROOT = join(__dirname, '..')
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'))
const logicSkills = getSkillsBySubject('logic')
const COUNT = 200

const skillById = (id: string): Skill => {
  const s = logicSkills.find((x) => x.id === id)
  if (!s) throw new Error(`missing skill ${id}`)
  return s
}
const gen = (id: string, n = COUNT, seed = 7, difficulty?: 1 | 2 | 3 | 4 | 5): Item[] =>
  generateItems(skillById(id), n, { seed, ...(difficulty ? { difficulty } : {}) })

type Grid = Extract<VisualSpec, { kind: 'grid' }>
const gridOf = (it: Item): Grid => {
  expect(it.visual?.kind).toBe('grid')
  return it.visual as Grid
}
const correctText = (it: Item): string => {
  const c = it as ChoiceItem
  return c.options.find((o) => o.id === c.correctId)?.text?.ro as string
}

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

/* ------------------------------------------------------------------ */
describe('logic skill graph', () => {
  it('has 12 valid skills across grades 0-IV with LUDIKO-LOGIC competences and own provenance', () => {
    expect(logicSkills.length).toBe(12)
    const dir = join(ROOT, 'content', 'skills', 'logic')
    const errors = readdirSync(dir).flatMap((f) => validateSkills(readJson(join(dir, f)), relative(ROOT, join(dir, f))))
    expect(errors).toEqual([])
    expect(new Set(logicSkills.map((s) => s.grade))).toEqual(new Set([0, 1, 2, 3, 4]))
    for (const s of logicSkills) {
      expect(s.competences.every((c) => c.programa === 'LUDIKO-LOGIC')).toBe(true)
      expect(s.provenance.source).toBe('own')
      expect(s.provenance.licence).toBe('OWN')
      expect(s.provenance.notes).toMatch(/own framework/)
      expect(s.title.en).toBeTruthy()
      expect(validateProvenance(s.provenance)).toEqual([])
    }
  })

  it('is part of a valid DAG; prerequisites stay inside logic', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([])
    for (const s of logicSkills) for (const p of s.prerequisites) expect(p.startsWith('logic.'), `${s.id} -> ${p}`).toBe(true)
  })

  it('every skill has a 3-frame beta ai-draft explanation that validates', () => {
    for (const s of logicSkills) {
      const e = getExplanation(s.explanations[0])
      expect(e, s.id).toBeTruthy()
      if (!e) continue
      expect(e.frames.length).toBe(3)
      expect(e.reviewStatus).toBe('beta')
      expect(e.provenance.source).toBe('ai-draft')
      expect(e.provenance.licence).toBe('OWN')
      expect(validateExplanation(e)).toEqual([])
      expect(e.frames.every((f) => f.text.en)).toBe(true)
    }
  })

  it('logic is a learner subject with emoji and i18n names', () => {
    expect(LEARN_SUBJECTS).toContain('logic')
    expect(SUBJECT_EMOJI.logic).toBe('🧩')
    expect(ro.learn.subject.logic).toBe('Jocuri de logică')
    expect(en.learn.subject.logic).toBe('Logic puzzles')
    expect(ro.frames.visual.grid).toBeTruthy()
    expect(en.frames.visual.gridStrip).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
describe('every logic generator: 200 valid items with a unique correct answer', () => {
  for (const s of [
    'logic.pattern.ab.0', 'logic.oddone.0', 'logic.pattern.abc.1', 'logic.oddone.1', 'logic.robot.1', 'logic.analogy.2',
    'logic.sudoku4.2', 'logic.pattern.number.3', 'logic.sudoku4.3', 'logic.where.3', 'logic.pattern.number.4', 'logic.where.4',
  ]) {
    it(s, () => {
      const items = gen(s)
      expect(items.length).toBe(COUNT)
      for (const it of items) {
        expect(validateItem(it), it.id).toEqual([])
        expect(it.prompt.ro).toMatch(/Ghicitoarea lui Ludi/)
        expect(it.prompt.en).toMatch(/Ludi's riddle/)
        if (it.type === 'choice') {
          const texts = it.options.map((o) => o.text?.ro)
          expect(new Set(texts).size, it.id).toBe(texts.length)
          expect(it.options.filter((o) => o.id === it.correctId).length).toBe(1)
          expect(checkResponse(it, { type: 'choice', selectedId: it.correctId })).toBe(true)
          for (const o of it.options.filter((o) => o.id !== it.correctId)) {
            expect(checkResponse(it, { type: 'choice', selectedId: o.id })).toBe(false)
          }
        } else if (it.type === 'number-input') {
          expect(checkResponse(it, { type: 'number-input', value: it.correct })).toBe(true)
          expect(checkResponse(it, { type: 'number-input', value: it.correct + 1 })).toBe(false)
        } else throw new Error(`unexpected type ${it.type}`)
      }
    })
  }

  it('is deterministic per seed and works at every difficulty', () => {
    expect(JSON.stringify(gen('logic.sudoku4.3', 30, 3))).toBe(JSON.stringify(gen('logic.sudoku4.3', 30, 3)))
    for (const s of logicSkills) {
      for (const d of [1, 2, 3, 4, 5] as const) {
        for (const it of gen(s.id, 25, 11, d)) expect(validateItem(it), `${s.id} d${d}`).toEqual([])
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('patterns', () => {
  const isPeriodic = (seq: string[], p: number) => seq.every((v, i) => i < p || v === seq[i - p])

  it('picture strips: exactly one option completes a periodic row (next element / missing in the middle)', () => {
    for (const id of ['logic.pattern.ab.0', 'logic.pattern.abc.1']) {
      for (const d of [1, 2, 3, 4, 5] as const) {
        for (const it of gen(id, 60, 5, d) as ChoiceItem[]) {
          const grid = gridOf(it)
          expect(grid.rows).toBe(1)
          const hole = grid.highlight as number
          expect(grid.cells[hole]).toBeNull()
          expect(grid.cells.filter((c) => c === null).length).toBe(1)
          const fits = it.options.filter((o) => {
            const seq = grid.cells.map((c, i) => (i === hole ? (o.text?.ro as string) : (c as string)))
            for (let p = 1; p * 2 <= seq.length; p++) if (isPeriodic(seq, p)) return true
            return false
          })
          expect(fits.map((o) => o.id), it.id).toEqual([it.correctId])
        }
      }
    }
  })

  it('shows at least two full cycles; AB skill only uses AB; all units are known', () => {
    for (const it of gen('logic.pattern.ab.0', 60)) {
      const cells = gridOf(it).cells
      expect(new Set(cells.filter(Boolean)).size).toBe(2)
    }
    expect(Object.keys(PATTERN_UNITS).sort()).toEqual(['AAB', 'AABB', 'AB', 'ABB', 'ABC'])
  })

  /** every rule family that fits the shown numbers must predict the same next number */
  function predictions(seq: number[]): Set<number> {
    const out = new Set<number>()
    const diffs = seq.slice(1).map((v, i) => v - seq[i])
    if (diffs.every((d) => d === diffs[0])) out.add(seq[seq.length - 1] + diffs[0])
    if (seq[0] > 0 && seq.slice(1).every((v, i) => v * seq[0] === seq[i + 1] * seq[0] && v === seq[i] * (seq[1] / seq[0])))
      out.add(seq[seq.length - 1] * (seq[1] / seq[0]))
    if (diffs.length >= 2 && diffs.every((d, i) => i === 0 || d === diffs[i - 1] + 1)) out.add(seq[seq.length - 1] + diffs[diffs.length - 1] + 1)
    if (diffs.length >= 4 && diffs[0] !== diffs[1] && diffs.every((d, i) => d === diffs[i % 2])) out.add(seq[seq.length - 1] + diffs[diffs.length % 2])
    return out
  }

  it('number patterns: the stated next number is the only prediction of every fitting rule', () => {
    for (const id of ['logic.pattern.number.3', 'logic.pattern.number.4']) {
      for (const d of [1, 2, 3, 4, 5] as const) {
        for (const it of gen(id, 80, 9, d) as NumberInputItem[]) {
          const grid = gridOf(it)
          const shown = grid.cells.slice(0, -1).map(Number)
          expect(grid.cells[grid.cells.length - 1]).toBeNull()
          expect(shown.every(Number.isFinite)).toBe(true)
          const p = predictions(shown)
          expect([...p], `${id} d${d}: ${shown.join(',')}`).toEqual([it.correct])
          expect(it.correct).toBeGreaterThan(0)
        }
      }
    }
  })

  it('number builder covers every rule', () => {
    const rng = mulberry32(1)
    for (const rule of ['add', 'sub', 'alt', 'mul', 'growing'] as const) {
      for (const level of [3, 4]) {
        const { shown, next } = buildNumberSequence(rng, rule, level)
        expect(shown.length).toBeGreaterThanOrEqual(4)
        expect(next).toBeGreaterThan(0)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('odd one out', () => {
  it('three options share a group (or parity) and one does not', () => {
    for (const id of ['logic.oddone.0', 'logic.oddone.1']) {
      for (const it of gen(id, COUNT) as ChoiceItem[]) {
        const texts = it.options.map((o) => o.text?.ro as string)
        if (texts.every((x) => /^\d+$/.test(x))) {
          const wantOdd = /celelalte sunt pare/.test(it.prompt.ro)
          const odd = texts.filter((x) => (Number(x) % 2 === 1) === wantOdd)
          expect(odd).toEqual([correctText(it)])
          continue
        }
        const setOf = Object.values(ODD_SETS).filter((g) => g.length && texts.every((x) => groupOf(g, x)))
        expect(setOf.length, texts.join(' ')).toBeGreaterThan(0)
        const ok = setOf.some((g) => {
          const groups = texts.map((x) => groupOf(g, x))
          const counts = new Map<string | undefined, number>()
          groups.forEach((gr) => counts.set(gr, (counts.get(gr) ?? 0) + 1))
          return counts.size === 2 && Math.min(...counts.values()) === 1 && groupOf(g, correctText(it)) !== undefined &&
            counts.get(groupOf(g, correctText(it))) === 1
        })
        expect(ok, texts.join(' ')).toBe(true)
      }
    }
  })

  it('odd-one groups never overlap inside a set', () => {
    for (const groups of Object.values(ODD_SETS)) {
      const all = groups.flatMap((g) => g.members)
      expect(new Set(all).size).toBe(all.length)
    }
  })
})

/* ------------------------------------------------------------------ */
describe('analogies', () => {
  it('curated pairs: unique left and right words inside each relation', () => {
    for (const r of ANALOGIES) {
      expect(new Set(r.pairs.map((p) => p[0])).size, r.id).toBe(r.pairs.length)
      expect(new Set(r.pairs.map((p) => p[2])).size, r.id).toBe(r.pairs.length)
      for (const p of r.pairs) expect(p.every((w) => w.length > 0)).toBe(true)
    }
  })

  it('the correct option is the right word of the asked left word, all options come from one relation', () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      for (const it of gen('logic.analogy.2', 80, 4, d) as ChoiceItem[]) {
        const m = it.prompt.ro.match(/riddle|Ghicitoarea lui Ludi: (.+) : (.+) = (.+) : \?/)
        const parts = it.prompt.ro.replace('Ghicitoarea lui Ludi: ', '').split(/ : | = /)
        expect(parts.length).toBe(4)
        expect(m).toBeTruthy()
        const [a, b, c] = parts
        const rel = ANALOGIES.find((r) => r.pairs.some((p) => p[0] === a && p[2] === b) && r.pairs.some((p) => p[0] === c) &&
          it.options.every((o) => r.pairs.some((p) => p[2] === o.text?.ro)))
        expect(rel, it.prompt.ro).toBeTruthy()
        const expected = rel?.pairs.find((p) => p[0] === c)?.[2]
        expect(correctText(it)).toBe(expected)
        expect(it.options.filter((o) => o.text?.ro === expected).length).toBe(1)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('mini-sudoku 4x4', () => {
  /** independent brute force: all completions of the empties */
  function completions(cells: (number | null)[]): number[][] {
    const empties = cells.flatMap((c, i) => (c === null ? [i] : []))
    const out: number[][] = []
    const total = 4 ** empties.length
    for (let n = 0; n < total; n++) {
      const g = cells.map((c) => c ?? 0)
      let k = n
      for (const i of empties) {
        g[i] = (k % 4) + 1
        k = Math.floor(k / 4)
      }
      if (isValidSudoku4(g)) out.push(g)
    }
    return out
  }

  it('random solutions are valid sudoku grids', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 300; i++) expect(isValidSudoku4(randomSolution(rng))).toBe(true)
  })

  it('the asked cell has exactly one possible digit over all completions, and it is the correct option', () => {
    for (const [id, empties] of [['logic.sudoku4.2', 1], ['logic.sudoku4.3', 2]] as const) {
      for (const it of gen(id, COUNT) as ChoiceItem[]) {
        const grid = gridOf(it)
        expect(grid.rows).toBe(4)
        expect(grid.cols).toBe(4)
        const cells = grid.cells.map((c) => (c === null ? null : Number(c)))
        expect(cells.filter((c) => c === null).length).toBe(empties)
        const hole = grid.highlight as number
        expect(cells[hole]).toBeNull()
        const all = completions(cells)
        expect(all.length, it.id).toBeGreaterThan(0)
        const digits = new Set(all.map((g) => g[hole]))
        expect([...digits], it.id).toHaveLength(1)
        expect(`n${[...digits][0]}`).toBe(it.correctId)
        expect(possibleDigits(cells, hole).size).toBe(1)
        // the given digits already obey the rules (no duplicate in any row/col/box among the clues)
        expect(isValidSudoku4(all[0])).toBe(true)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('robot path', () => {
  const REVERSE: Record<string, Move> = Object.fromEntries(Object.entries(MOVE_ARROWS).map(([m, a]) => [a, m as Move]))

  it('the correct option is the picture on the cell where the arrows lead (inside the grid, not the start)', () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      for (const it of gen('logic.robot.1', 80, 13, d) as ChoiceItem[]) {
        const grid = gridOf(it)
        expect(grid.rows).toBe(3)
        expect(new Set(grid.cells).size).toBe(9)
        const arrows = Object.values(MOVE_ARROWS).flatMap((a) => it.prompt.ro.split(a).slice(1).map(() => a))
        const seqText = it.prompt.ro.match(/pașii (.+)\. Pe ce/)?.[1] ?? ''
        const moves = seqText.split(' ').map((a) => REVERSE[a])
        expect(moves.every(Boolean)).toBe(true)
        expect(arrows.length).toBe(moves.length)
        expect(moves.length).toBeGreaterThanOrEqual(2)
        let at = grid.cells.indexOf('🤖')
        expect(at).toBeGreaterThanOrEqual(0)
        const start = at
        let r = Math.floor(at / 3)
        let c = at % 3
        for (const m of moves) {
          r += MOVE_DELTA[m][0]
          c += MOVE_DELTA[m][1]
          expect(r >= 0 && r < 3 && c >= 0 && c < 3, it.prompt.ro).toBe(true)
        }
        at = r * 3 + c
        expect(at).not.toBe(start)
        expect(correctText(it)).toBe(grid.cells[at])
        expect(it.options.some((o) => o.text?.ro === '🤖')).toBe(false)
      }
    }
  })

  it('supports a 4x4 map too', async () => {
    const { buildRobot, followMoves } = await import('@/engine/items/generators/logicRobot')
    const rng = mulberry32(5)
    for (let i = 0; i < 100; i++) {
      const p = buildRobot(rng, 4, 5)
      expect(followMoves(4, p.start, p.moves)).toBe(p.end)
      expect(p.end).not.toBe(p.start)
    }
  })
})

/* ------------------------------------------------------------------ */
describe('who lives where', () => {
  it('clues leave exactly one arrangement and it gives the stated answer', () => {
    const rng = mulberry32(77)
    for (const n of [3, 4]) {
      const all = permutations(n)
      expect(all.length).toBe(n === 3 ? 6 : 24)
      for (let i = 0; i < 150; i++) {
        const p = buildWhere(rng, n)
        const alive = all.filter((arr) => p.clues.every((c) => satisfies(arr, c)))
        expect(alive.length).toBe(1)
        expect(alive[0][p.asked]).toBe(p.answer)
        expect(p.clues.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('items mention every friend, give 2+ clues and highlight the asked house', () => {
    for (const [id, n] of [['logic.where.3', 3], ['logic.where.4', 4]] as const) {
      for (const it of gen(id, 60) as ChoiceItem[]) {
        const grid = gridOf(it)
        expect(grid.cols).toBe(n)
        expect(it.options.length).toBe(n)
        for (const o of it.options) expect(it.prompt.ro).toContain(o.text?.ro as string)
        expect((it.prompt.ro.match(/\./g) ?? []).length).toBeGreaterThanOrEqual(2)
        expect(grid.highlight).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('grid visual', () => {
  const strip: VisualSpec = { kind: 'grid', rows: 1, cols: 4, cells: ['🍎', '🍌', '🍎', null], highlight: 3 }
  const sudoku: VisualSpec = { kind: 'grid', rows: 4, cols: 4, cells: Array.from({ length: 16 }, (_, i) => (i === 5 ? null : String((i % 4) + 1))), highlight: 5 }

  it('renders an accessible SVG with one box per cell, "?" for the empty one', () => {
    const { container } = render(<Visual spec={strip} />)
    const svg = container.querySelector('svg') as SVGSVGElement
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.querySelectorAll('rect').length).toBe(4)
    expect(svg.textContent).toContain('?')
    expect(container.querySelector('[data-visual="grid"]')).toBeTruthy()
    const label = svg.getAttribute('aria-label') as string
    expect(label).toContain('🍎')
    expect(label).toContain('gol')
  })

  it('draws box borders only for 4x4 grids', () => {
    const a = render(<Visual spec={sudoku} />).container.querySelector('svg') as SVGSVGElement
    expect(a.querySelectorAll('line').length).toBe(2)
    expect(a.querySelectorAll('rect').length).toBe(17)
    const b = render(<Visual spec={strip} />).container.querySelector('svg') as SVGSVGElement
    expect(b.querySelectorAll('line').length).toBe(0)
  })

  it('labels are localised and never reveal more than what is drawn', async () => {
    const roLabel = visualLabel(sudoku, i18n.t.bind(i18n) as any, 'ro')
    expect(roLabel).toMatch(/4 rânduri/)
    await i18n.changeLanguage('en')
    expect(visualLabel(strip, i18n.t.bind(i18n) as any, 'en')).toMatch(/Strip of 4 squares: 🍎, 🍌, 🍎, empty/)
    await i18n.changeLanguage('ro')
  })

  it('validation accepts good specs and rejects bad ones', () => {
    expect(validateVisual(strip, 'v')).toEqual([])
    expect(validateVisual(sudoku, 'v')).toEqual([])
    expect(validateVisual({ ...strip, cells: ['a'] }, 'v').join()).toMatch(/entries/)
    expect(validateVisual({ ...strip, highlight: 9 }, 'v').join()).toMatch(/highlight/)
    expect(validateVisual({ ...strip, rows: 0 }, 'v').join()).toMatch(/rows/)
    expect(validateVisual({ ...strip, cells: ['', 'a', 'b', null] }, 'v').join()).toMatch(/cell/)
    expect(validateVisual({ ...strip, extra: 1 }, 'v').join()).toMatch(/unknown field/)
  })
})
