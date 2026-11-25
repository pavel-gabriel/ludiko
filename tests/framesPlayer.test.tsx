import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n/config'
import FramesPlayer from '@/ui/frames/FramesPlayer'
import { addingCrossingTen } from '@/ui/frames/samples'
import type { Explanation } from '@/engine/types'

beforeAll(async () => {
  // jsdom has no PointerEvent: a MouseEvent subclass carries clientX/clientY for the swipe tests
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {}
    ;(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = PointerEventPolyfill
  }
  await i18n.changeLanguage('ro')
})

const total = addingCrossingTen.frames.length

describe('<FramesPlayer />', () => {
  it('starts on the first frame with Back disabled', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Înapoi/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Mai departe/ })).toBeEnabled()
    expect(screen.getAllByRole('img').length).toBe(1)
  })

  it('goes forward and back one frame at a time', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Mai departe/ }))
    expect(screen.getByText(addingCrossingTen.frames[1].text.ro)).toBeInTheDocument()
    expect(screen.queryByText(addingCrossingTen.frames[0].text.ro)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }))
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
  })

  it('shows progress dots and marks the current step', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    const dots = screen.getAllByRole('button', { name: /^Pasul \d din \d$/ })
    expect(dots).toHaveLength(total)
    expect(dots[0]).toHaveAttribute('aria-current', 'step')
    fireEvent.click(dots[2])
    expect(screen.getByText(addingCrossingTen.frames[2].text.ro)).toBeInTheDocument()
    expect(dots[2]).toHaveAttribute('aria-current', 'step')
  })

  it('only offers "Am înțeles!" on the last frame and calls onDone', () => {
    const onDone = vi.fn()
    render(<FramesPlayer explanation={addingCrossingTen} onDone={onDone} />)
    expect(screen.queryByRole('button', { name: /Am înțeles/ })).not.toBeInTheDocument()
    for (let i = 0; i < total - 1; i++) {
      expect(onDone).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: /Mai departe/ }))
    }
    expect(screen.queryByRole('button', { name: /Mai departe/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Am înțeles/ }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('swipes left for next and right for back', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    const area = screen.getByTestId('frame-area')
    fireEvent.pointerDown(area, { clientX: 300, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 150, clientY: 110 })
    expect(screen.getByText(addingCrossingTen.frames[1].text.ro)).toBeInTheDocument()
    fireEvent.pointerDown(area, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 260, clientY: 105 })
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
  })

  it('ignores short or mostly-vertical drags', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    const area = screen.getByTestId('frame-area')
    fireEvent.pointerDown(area, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 170, clientY: 100 })
    fireEvent.pointerDown(area, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 120, clientY: 300 })
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
  })

  it('does not call onDone when swiping past the last frame', () => {
    const onDone = vi.fn()
    render(<FramesPlayer explanation={addingCrossingTen} onDone={onDone} />)
    const dots = screen.getAllByRole('button', { name: /^Pasul/ })
    fireEvent.click(dots[total - 1])
    const area = screen.getByTestId('frame-area')
    fireEvent.pointerDown(area, { clientX: 300, clientY: 100 })
    fireEvent.pointerUp(area, { clientX: 100, clientY: 100 })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('supports arrow keys', () => {
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    const region = screen.getByRole('region')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByText(addingCrossingTen.frames[1].text.ro)).toBeInTheDocument()
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(screen.getByText(addingCrossingTen.frames[0].text.ro)).toBeInTheDocument()
  })

  it('shows a narration button only when the frame has audio', () => {
    const withAudio: Explanation = {
      ...addingCrossingTen,
      id: 'sample.audio',
      frames: [
        { ...addingCrossingTen.frames[0], audio: { kind: 'audio', src: 'audio/x.mp3', alt: { ro: 'Narare' } } },
        addingCrossingTen.frames[1],
      ],
    }
    render(<FramesPlayer explanation={withAudio} onDone={() => {}} />)
    expect(screen.getByRole('button', { name: /Ascultă/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mai departe/ }))
    expect(screen.queryByRole('button', { name: /Ascultă/ })).not.toBeInTheDocument()
  })

  it('resets to the first frame when the explanation changes', () => {
    const other: Explanation = { ...addingCrossingTen, id: 'sample.other' }
    const { rerender } = render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Mai departe/ }))
    rerender(<FramesPlayer explanation={other} onDone={() => {}} />)
    expect(screen.getByText(other.frames[0].text.ro)).toBeInTheDocument()
  })

  it('uses English text when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    render(<FramesPlayer explanation={addingCrossingTen} onDone={() => {}} />)
    expect(screen.getByText(addingCrossingTen.frames[0].text.en!)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument()
    await i18n.changeLanguage('ro')
  })
})
