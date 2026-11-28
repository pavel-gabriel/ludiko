import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * docs/SECURITY.md: GitHub Pages cannot send headers, so index.html carries the Content-Security-Policy and
 * referrer policy as <meta> tags. These checks keep the CSP in step with the inline script (hash) and stop it
 * from being loosened by accident. The policy itself was verified in a production build with Playwright.
 */
const html = readFileSync('index.html', 'utf8')
const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
const directive = (name: string) =>
  csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? ''

describe('index.html security meta tags', () => {
  it('has a CSP meta tag before any script', () => {
    expect(csp).not.toBe('')
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'))
  })

  it('every inline script is allowed by its sha256 hash (update the CSP when you edit one)', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(inline.length).toBeGreaterThan(0)
    for (const body of inline) {
      const hash = createHash('sha256').update(body).digest('base64')
      expect(directive('script-src'), `missing 'sha256-${hash}'`).toContain(`'sha256-${hash}'`)
    }
  })

  it('never allows unsafe script sources, plugins or a foreign <base>', () => {
    expect(directive('script-src')).not.toMatch(/unsafe-inline|unsafe-eval|\*(?!\.)|data:|http:/)
    expect(directive('default-src')).toBe("default-src 'self'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
  })

  it('allows exactly the Firebase endpoints the app uses (Auth, Firestore, RTDB websocket + long-poll)', () => {
    for (const h of ['https://*.googleapis.com', 'wss://*.firebaseio.com', 'wss://*.firebasedatabase.app'])
      expect(directive('connect-src')).toContain(h)
    for (const h of ['https://apis.google.com', 'https://*.firebaseio.com', 'https://*.firebasedatabase.app'])
      expect(directive('script-src')).toContain(h)
    expect(directive('frame-src')).toContain('https://*.firebaseapp.com')
  })

  it('sends only the origin to other sites', () => {
    expect(html).toContain('<meta name="referrer" content="strict-origin-when-cross-origin" />')
  })
})
