import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from '@/i18n/config'
import SessionRunner from '@/ui/session/SessionRunner'
import { addingCrossingTen } from '@/ui/frames/samples'
import type { Explanation, Item, ItemResult, ChoiceItem, NumberInputItem, TrueFalseItem } from '@/engine/types'
import type { SessionSummary } from '@/ui/session/types'
import { requeue, buildQueue, starsForAccuracy, filterForMode } from '@/ui/session/sessionLogic'

const prov = { id: 'p', kind: 'item' as const, title: 't', author: 'Ludiko', source: 'own' as const, licence: 'OWN' as const }
const base = { skillId: 'test.skill', difficulty: 1 as const, reviewStatus: 'beta' as const, provenance: prov }

function choice(n: number): ChoiceItem {
  return {
    ...base,
    id: `q${n}`,
    type: 'choice',
    prompt: { ro: `Întrebarea ${n}` },
    options: [
      { id: 'ok', text: { ro: 'Bun' } },
      { id: 'no', text: { ro: 'Rău' } },
    ],
    correctId: 'ok',
  }
}
const choices = (n: number) => Array.from({ length: n }, (_, i) => choice(i + 1))

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
/** Tap an answer; correct answers advance after the 900 ms feedback */
function answerCorrect() {
  fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
  tick(1000)
}
/** Tap a wrong answer, then "Mai departe" in the feedback panel */
function answerWrong() {
  fireEvent.click(screen.getByRole('button', { name: /^Rău/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }))
}
const prompt = (n: number) => screen.queryByRole('heading', { name: `Întrebarea ${n}` })

function setup(props: Partial<React.ComponentProps<typeof SessionRunner>> & { items: Item[] }) {
  const onFinish = vi.fn<(s: SessionSummary) => void>()
  const onAttempt = vi.fn<(r: ItemResult, i: Item) => void>()
  const utils = render(<SessionRunner mode="practice" onFinish={onFinish} onAttempt={onAttempt} {...props} />)
  return { onFinish, onAttempt, ...utils }
}

describe('SessionRunner: practice', () => {
  it('moves to the next item after a correct answer and finishes with a summary', () => {
    const { onFinish } = setup({ items: choices(2) })
    expect(prompt(1)).toBeInTheDocument()
    answerCorrect()
    expect(prompt(2)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    answerCorrect()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const s = onFinish.mock.calls[0][0]
    expect(s).toMatchObject({ mode: 'practice', completed: true, total: 2, correct: 2, accuracy: 1, stars: 3 })
    expect(s.review).toEqual([])
  })

  it('shows the explanation after a wrong answer, then re-queues the item a few items later, once', () => {
    const getExplanation = vi.fn((id: string): Explanation | undefined => (id === 'exp.x' ? addingCrossingTen : undefined))
    const items = choices(5)
    items[0] = { ...items[0], explanationId: 'exp.x' }
    const { onFinish } = setup({ items, getExplanation })

    answerWrong()
    expect(getExplanation).toHaveBeenCalledWith('exp.x')
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
    expect(prompt(1)).not.toBeInTheDocument()
    expect(screen.getByText(/Mai încercăm o dată puțin mai târziu/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sari peste' }))
    expect(prompt(2)).toBeInTheDocument()
    answerCorrect() // 2
    answerCorrect() // 3
    answerCorrect() // 4
    // the missed item is back, labelled as another try
    expect(prompt(1)).toBeInTheDocument()
    expect(screen.getByText(/Încă o încercare/)).toBeInTheDocument()
    // missing it again does not queue it a second time
    answerWrong()
    expect(screen.queryByText(addingCrossingTen.frames[0].text.ro)).not.toBeInTheDocument()
    expect(prompt(5)).toBeInTheDocument()
    answerCorrect()

    expect(onFinish).toHaveBeenCalledTimes(1)
    const s = onFinish.mock.calls[0][0]
    expect(s.total).toBe(5)
    expect(s.correct).toBe(4)
    expect(s.stars).toBe(2)
    expect(s.attempts).toHaveLength(6)
    expect(s.attempts.filter((a) => a.retry)).toHaveLength(1)
    expect(s.review.map((r) => r.itemId)).toEqual(['q1'])
  })

  it('counts a correct retry as a retry, not as a first-try success', () => {
    const { onFinish } = setup({ items: choices(2) })
    answerWrong() // q1 wrong, no explanation provider -> straight on
    expect(prompt(2)).toBeInTheDocument()
    answerCorrect()
    expect(prompt(1)).toBeInTheDocument() // queue shorter than the gap: comes back at the end
    answerCorrect()
    const s = onFinish.mock.calls[0][0]
    expect(s).toMatchObject({ total: 2, correct: 1, accuracy: 0.5, stars: 1 })
    expect(s.attempts.map((a) => [a.itemId, a.correct, a.retry])).toEqual([
      ['q1', false, false],
      ['q2', true, false],
      ['q1', true, true],
    ])
  })

  it('shows a report button on each item and a progress path', () => {
    setup({ items: choices(3) })
    expect(screen.getByRole('button', { name: 'Raportează o greșeală' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Exercițiul 1 din 3' })).toBeInTheDocument()
  })

  it('calls onAttempt for every answer with the item and retry meta', () => {
    const { onAttempt } = setup({ items: choices(2) })
    answerWrong()
    answerCorrect()
    answerCorrect()
    expect(onAttempt).toHaveBeenCalledTimes(3)
    const [r0, item0, meta0] = onAttempt.mock.calls[0] as unknown as [ItemResult, Item, { retry: boolean }]
    expect(r0).toMatchObject({ itemId: 'q1', correct: false })
    expect(item0.skillId).toBe('test.skill')
    expect(meta0).toEqual({ retry: false })
    const meta2 = (onAttempt.mock.calls[2] as unknown as [unknown, unknown, { retry: boolean }])[2]
    expect(meta2).toEqual({ retry: true })
  })

  it('falls back to the skill id when an item has no explanationId', () => {
    const getExplanation = vi.fn((): Explanation | undefined => undefined)
    setup({ items: choices(2), getExplanation })
    answerWrong()
    expect(getExplanation).toHaveBeenCalledWith('test.skill')
  })
})

describe('SessionRunner: check', () => {
  it('shows no explanation and does not re-queue', () => {
    const getExplanation = vi.fn(() => addingCrossingTen)
    const { onFinish } = setup({ items: choices(2), mode: 'check', getExplanation })
    answerWrong()
    expect(getExplanation).not.toHaveBeenCalled()
    expect(prompt(2)).toBeInTheDocument()
    answerCorrect()
    const s = onFinish.mock.calls[0][0]
    expect(s).toMatchObject({ mode: 'check', total: 2, correct: 1, completed: true })
    expect(s.attempts).toHaveLength(2)
  })
})

describe('SessionRunner: sprint', () => {
  const numberItem: NumberInputItem = { ...base, id: 'n1', type: 'number-input', prompt: { ro: 'Cât face 2 + 3?' }, correct: 5 }
  const tfItem: TrueFalseItem = { ...base, id: 't1', type: 'true-false', prompt: { ro: 'Adevărat sau fals?' }, correct: true }

  it('filters out item types that are not quick to answer', () => {
    const items: Item[] = [tfItem, numberItem, choice(1)]
    expect(filterForMode(items, 'sprint').map((i) => i.id)).toEqual(['n1', 'q1'])
    expect(filterForMode(items, 'practice')).toHaveLength(3)
    setup({ items: [tfItem, choice(1)], mode: 'sprint' })
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }))
    expect(prompt(1)).toBeInTheDocument()
    expect(screen.queryByText('Adevărat sau fals?')).not.toBeInTheDocument()
  })

  it('waits for Start, then ends when the time runs out', () => {
    const { onFinish } = setup({ items: choices(2), mode: 'sprint', sprintSeconds: 10 })
    tick(30000)
    expect(onFinish).not.toHaveBeenCalled() // clock has not started yet
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }))
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Au mai rămas 10 secunde')

    answerCorrect()
    tick(3000)
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Au mai rămas 6 secunde')
    expect(onFinish).not.toHaveBeenCalled()
    tick(7000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const s = onFinish.mock.calls[0][0]
    expect(s).toMatchObject({ mode: 'sprint', completed: true, total: 1, correct: 1 })
  })

  it('never shows an explanation, and cycles through the items until the time is up', () => {
    const getExplanation = vi.fn(() => addingCrossingTen)
    const { onFinish } = setup({ items: [choice(1)], mode: 'sprint', sprintSeconds: 20, getExplanation })
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }))
    answerWrong()
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    tick(500)
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    tick(500)
    expect(getExplanation).not.toHaveBeenCalled()
    tick(25000)
    const s = onFinish.mock.calls[0][0]
    expect(s.total).toBe(3)
    expect(s.correct).toBe(2)
    expect(s.attempts.every((a) => !a.retry)).toBe(true)
  })

  it('shows a friendly empty state when no item is sprint-friendly', () => {
    const onExit = vi.fn()
    setup({ items: [tfItem], mode: 'sprint', onExit })
    expect(screen.getByText(/Încă pregătim exerciții/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Înapoi' }))
    expect(onExit).toHaveBeenCalled()
  })
})

describe('SessionRunner: leaving', () => {
  it('asks for confirmation and keeps playing when the child stays', () => {
    const onExit = vi.fn()
    const { onFinish } = setup({ items: choices(2), onExit })
    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    expect(screen.getByRole('dialog', { name: 'Facem o pauză?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuăm' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onExit).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('leaves through onExit when given', () => {
    const onExit = vi.fn()
    const { onFinish } = setup({ items: choices(2), onExit })
    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gata pe azi' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('reports an incomplete summary when there is no onExit', () => {
    const { onFinish } = setup({ items: choices(3) })
    answerCorrect()
    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gata pe azi' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ completed: false, total: 1, correct: 1 })
  })

  it('pauses the sprint clock while the exit dialog is open', () => {
    const { onFinish } = setup({ items: choices(2), mode: 'sprint', sprintSeconds: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    tick(60000)
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuăm' }))
    tick(1000)
    expect(onFinish).not.toHaveBeenCalled()
    tick(9500)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

describe('sessionLogic', () => {
  it('gives every answered session at least one star, never zero for effort', () => {
    expect(starsForAccuracy(0, 5)).toBe(1)
    expect(starsForAccuracy(0.6, 5)).toBe(2)
    expect(starsForAccuracy(0.9, 10)).toBe(3)
    expect(starsForAccuracy(0, 0)).toBe(0)
  })

  it('re-queues a few slots later or at the end of a short queue', () => {
    const q = buildQueue(choices(6))
    const long = requeue(q, 0, q[0].item, 1)
    expect(long.map((e) => e.item.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q1', 'q5', 'q6'])
    expect(long[4].retry).toBe(true)
    const short = requeue(buildQueue(choices(2)), 0, q[0].item, 2)
    expect(short.map((e) => e.item.id)).toEqual(['q1', 'q2', 'q1'])
  })
})
