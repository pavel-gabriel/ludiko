import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown) => void

/** Evaluate public/push-sw.js against a fake service-worker global */
function loadSw(scope: string, windows: { url: string; focus: () => unknown }[] = []) {
  const handlers: Record<string, Handler> = {}
  const showNotification = vi.fn(async () => {})
  const openWindow = vi.fn(async () => null)
  const self = {
    registration: { scope, showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
  }
  const code = readFileSync(path.resolve(__dirname, '../public/push-sw.js'), 'utf8')
  vm.runInNewContext(code, { self, URL })
  return { handlers, showNotification, openWindow, self }
}

const pushEvent = (payload: unknown) => {
  const waits: Promise<unknown>[] = []
  return {
    event: {
      data: { json: () => payload, text: () => String(payload) },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    },
    done: () => Promise.all(waits),
  }
}

describe('public/push-sw.js', () => {
  it('shows the payload as a notification with icons resolved against the scope', async () => {
    const sw = loadSw('https://ludiko.example/')
    const { event, done } = pushEvent({ title: 'Ludiko', body: 'Bitul de azi te așteaptă!', url: '/learn', tag: 'ludiko-daily' })
    sw.handlers.push(event)
    await done()
    expect(sw.showNotification).toHaveBeenCalledWith('Ludiko', {
      body: 'Bitul de azi te așteaptă!',
      icon: 'https://ludiko.example/icons/icon-192.png',
      badge: 'https://ludiko.example/icons/icon-192.png',
      tag: 'ludiko-daily',
      data: { url: 'https://ludiko.example/learn' },
    })
  })

  it('works from a sub-path scope (the leading slash of the payload url is not root-absolute)', async () => {
    const sw = loadSw('https://user.github.io/ludiko/')
    const { event, done } = pushEvent({ title: 'T', body: 'B', url: '/learn', tag: 'x' })
    sw.handlers.push(event)
    await done()
    const options = (sw.showNotification.mock.calls[0] as unknown as [string, { icon: string; data: { url: string } }])[1]
    expect(options.icon).toBe('https://user.github.io/ludiko/icons/icon-192.png')
    expect(options.data.url).toBe('https://user.github.io/ludiko/learn')
  })

  it('still shows something sensible for an empty or non-JSON payload', async () => {
    const sw = loadSw('https://ludiko.example/')
    const waits: Promise<unknown>[] = []
    sw.handlers.push({
      data: { json: () => { throw new Error('not json') }, text: () => 'plain text' },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    sw.handlers.push({ data: null, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
    expect(sw.showNotification).toHaveBeenNthCalledWith(1, 'Ludiko', expect.objectContaining({ body: 'plain text', tag: 'ludiko-daily' }))
    expect(sw.showNotification).toHaveBeenNthCalledWith(2, 'Ludiko', expect.objectContaining({ body: '', data: { url: 'https://ludiko.example/learn' } }))
  })

  it('notificationclick focuses an existing app window', async () => {
    const focus = vi.fn(async () => {})
    const sw = loadSw('https://ludiko.example/', [
      { url: 'https://other.example/', focus: vi.fn() },
      { url: 'https://ludiko.example/learn/bit/mat/1', focus },
    ])
    const waits: Promise<unknown>[] = []
    const close = vi.fn()
    sw.handlers.notificationclick({
      notification: { close, data: { url: 'https://ludiko.example/learn' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(sw.openWindow).not.toHaveBeenCalled()
  })

  it('notificationclick opens the url when no app window is open', async () => {
    const sw = loadSw('https://ludiko.example/')
    const waits: Promise<unknown>[] = []
    sw.handlers.notificationclick({
      notification: { close: vi.fn(), data: { url: 'https://ludiko.example/learn' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(sw.openWindow).toHaveBeenCalledWith('https://ludiko.example/learn')
  })
})
