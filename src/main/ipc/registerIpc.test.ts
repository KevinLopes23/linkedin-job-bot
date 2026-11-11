import { describe, expect, it } from 'vitest'
import { isTrustedSender, requireLinkedInUrl } from './registerIpc'

describe('requireLinkedInUrl', () => {
  it('aceita só https do LinkedIn', () => {
    expect(requireLinkedInUrl('https://br.linkedin.com/jobs/view/4012345678')).toBe('https://br.linkedin.com/jobs/view/4012345678')
    expect(requireLinkedInUrl('https://www.linkedin.com/jobs/view/1')).toContain('linkedin.com')
  })

  it.each(['http://br.linkedin.com/jobs/view/1', 'https://linkedin.com.evil.io/x', 'https://evil.io/?linkedin.com', 'file:///C:/x', 'javascript:alert(1)', 42])(
    'recusa %s',
    (url) => expect(() => requireLinkedInUrl(url)).toThrow()
  )
})

describe('isTrustedSender', () => {
  const appIndex = 'file:///C:/Program%20Files/Vagalume/resources/app.asar/out/renderer/index.html'
  const dev = 'http://localhost:5173'

  it('aceita exatamente o index do app (também com query/hash e outra caixa do drive) e o dev server', () => {
    expect(isTrustedSender(appIndex, null, appIndex)).toBe(true)
    expect(isTrustedSender(`${appIndex}?x=1#topo`, null, appIndex)).toBe(true)
    expect(isTrustedSender(appIndex.replace('C:', 'c:'), null, appIndex)).toBe(true)
    expect(isTrustedSender('http://localhost:5173/', dev, appIndex)).toBe(true)
  })

  it.each([
    ['file:///C:/Users/x/Downloads/renderer/index.html', null],
    ['file://evil-host/share/renderer/index.html', null],
    ['file:///C:/Program%20Files/Vagalume/resources/app.asar/out/renderer/outra.html', null],
    ['http://localhost:5173/', null],
    ['http://localhost:9999/', dev],
    ['https://www.linkedin.com/jobs/view/1', dev],
    [undefined, null],
    ['não é url', null]
  ])('recusa %s', (url, devOrigin) => expect(isTrustedSender(url, devOrigin, appIndex)).toBe(false))
})
