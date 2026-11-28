import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import AppRoutes from '@/app/AppRoutes'

afterEach(cleanup)

describe('unknown routes', () => {
  it('show a friendly "page not found" with a way home, not a blank screen', async () => {
    await i18n.changeLanguage('ro')
    render(
      <MemoryRouter initialEntries={['/nope/unknown']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByTestId('not-found')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pagina nu există' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acasă' })).toHaveAttribute('href', '/')
  })

  it('has the English strings too', async () => {
    await i18n.changeLanguage('en')
    render(
      <MemoryRouter initialEntries={['/definitely/not/here']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    await i18n.changeLanguage('ro')
  })
})
