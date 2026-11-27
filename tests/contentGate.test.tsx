import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'

/* A pack that is not in memory yet: ensurePacks is controlled by the test */
const state = { loaded: false, calls: 0, fail: false }
vi.mock('@/engine/content/packs', () => ({
  packsLoaded: () => state.loaded,
  ensurePacks: vi.fn(async () => {
    state.calls += 1
    if (state.fail) throw new Error('offline')
    state.loaded = true
  }),
}))

import ContentGate from '@/ui/content/ContentGate'

const renderGate = (inline = false) =>
  render(
    <MemoryRouter>
      <ContentGate packs={['mat-p']} inline={inline}>
        <p>inside</p>
      </ContentGate>
    </MemoryRouter>,
  )

describe('ContentGate', () => {
  beforeEach(async () => {
    Object.assign(state, { loaded: false, calls: 0, fail: false })
    await i18n.changeLanguage('ro')
  })

  it('shows children at once when the packs are already loaded', () => {
    state.loaded = true
    renderGate()
    expect(screen.getByText('inside')).toBeInTheDocument()
    expect(state.calls).toBe(0)
  })

  it('loads, then renders the children', async () => {
    renderGate()
    expect(screen.queryByText('inside')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText('inside')).toBeInTheDocument()
    expect(state.calls).toBe(1)
  })

  it('offline and not cached: a friendly error with a working retry (inline)', async () => {
    state.fail = true
    renderGate(true)
    const retry = await screen.findByRole('button', { name: i18n.t('learn.retry') })
    state.fail = false
    await act(async () => {
      fireEvent.click(retry)
    })
    expect(await screen.findByText('inside')).toBeInTheDocument()
    expect(state.calls).toBe(2)
  })
})
