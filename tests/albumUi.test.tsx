import { beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '@/i18n/config'
import AlbumView from '@/ui/album/AlbumView'
import { ALL_STICKER_IDS, STICKER_SETS, skillStickerId, streakStickerId } from '@/ui/album/stickerSets'
import { MASCOT_MOODS, MascotSvg } from '@/ui/mascot/Mascot'
import Mascot from '@/ui/learn/Mascot'

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

describe('AlbumView', () => {
  it('empty album: every slot is a "?" placeholder and the child is invited to earn the first sticker', () => {
    render(<AlbumView owned={[]} />)
    expect(screen.queryAllByTestId('sticker-earned')).toHaveLength(0)
    expect(screen.getAllByTestId('sticker-locked').length).toBeGreaterThanOrEqual(ALL_STICKER_IDS.length)
    expect(screen.getByTestId('album-empty')).toBeInTheDocument()
    expect(screen.getByTestId('album-count')).toHaveTextContent(`0 din ${ALL_STICKER_IDS.length} autocolante`)
    // one section per set plus the special one
    for (const set of STICKER_SETS) expect(screen.getByTestId(`album-set-${set.id}`)).toBeInTheDocument()
    expect(screen.getByTestId('album-set-special')).toBeInTheDocument()
  })

  it('partly filled: earned stickers are buttons, the rest stay "?", counts per set, "nou!" badge on new ones', () => {
    const animals = STICKER_SETS[0].stickers.map((s) => s.id)
    const owned = [...animals.slice(0, 3), streakStickerId(3), skillStickerId('mat.count.20')]
    render(<AlbumView owned={owned} newIds={[animals[2], streakStickerId(3)]} skillTitle={() => 'Numărăm'} />)

    expect(screen.getAllByTestId('sticker-earned')).toHaveLength(5)
    const set = screen.getByTestId('album-set-animals')
    expect(within(set).getByText('3 din 10')).toBeInTheDocument()
    expect(within(set).getAllByTestId('sticker-locked')).toHaveLength(7)
    expect(within(set).getByRole('button', { name: 'Deschide autocolantul: Vulpe' })).toBeInTheDocument()
    expect(screen.getAllByTestId('sticker-new')).toHaveLength(2)
    expect(within(set).getAllByTestId('sticker-new')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Deschide autocolantul: Insulă cucerită: Numărăm' })).toBeInTheDocument()
    // locked slots of other sets are untouched
    expect(within(screen.getByTestId('album-set-fruits')).getByText('0 din 10')).toBeInTheDocument()
  })

  it('a complete set says so', () => {
    const space = STICKER_SETS[2].stickers.map((s) => s.id)
    render(<AlbumView owned={space} />)
    expect(within(screen.getByTestId('album-set-space')).getByText('Set complet!')).toBeInTheDocument()
  })

  it('tapping an earned sticker shows it big with the mascot cheering, and it can be closed', () => {
    render(<AlbumView owned={['🦊']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deschide autocolantul: Vulpe' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('sticker-big')).toHaveTextContent('🦊')
    expect(within(dialog).getByRole('img', { name: 'Ludi se bucură' })).toBeInTheDocument()
    expect(within(dialog).getByText('Ai găsit: Vulpe!')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gata' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('old saved ids (first version) show up in their new sets', () => {
    render(<AlbumView owned={['🐙', '🐳', '🦊']} />)
    expect(within(screen.getByTestId('album-set-sea')).getByText('2 din 10')).toBeInTheDocument()
    expect(within(screen.getByTestId('album-set-animals')).getByText('1 din 10')).toBeInTheDocument()
  })
})

describe('Mascot (Ludi)', () => {
  it.each(MASCOT_MOODS)('renders the "%s" mood as an image with an accessible label', (mood) => {
    const { container } = render(<MascotSvg mood={mood} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label')
    expect(img.getAttribute('aria-label')).toMatch(/^Ludi/)
    expect(container.querySelector('svg')).toHaveAttribute('data-mood', mood)
  })

  it('has a different label per mood, and in English too', async () => {
    const ro = MASCOT_MOODS.map((m) => {
      const { unmount } = render(<MascotSvg mood={m} />)
      const label = screen.getByRole('img').getAttribute('aria-label')
      unmount()
      return label
    })
    expect(new Set(ro).size).toBe(MASCOT_MOODS.length)
    await i18n.changeLanguage('en')
    render(<MascotSvg mood="sleep" />)
    expect(screen.getByRole('img', { name: 'Ludi is sleeping' })).toBeInTheDocument()
    await i18n.changeLanguage('ro')
  })

  it('can be decorative (hidden) next to text, and the speech-bubble wrapper keeps its old props', () => {
    render(
      <Mascot emoji="🌙" mood="sleep">
        <p>Hai să ne odihnim</p>
      </Mascot>,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Hai să ne odihnim')).toBeInTheDocument()
  })
})
