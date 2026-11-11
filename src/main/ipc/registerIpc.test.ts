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
  it('aceita a página do app (empacotada ou dev server)', () => {
    expect(isTrustedSender('file:///C:/Program%20Files/Vagalume/resources/app.asar/out/renderer/index.html', null)).toBe(true)
    expect(isTrustedSender('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
  })

  it.each([
    ['file:///C:/Users/x/Downloads/pagina.html', null],
    ['http://localhost:5173/', null],
    ['http://localhost:9999/', 'http://localhost:5173'],
    ['https://www.linkedin.com/jobs/view/1', 'http://localhost:5173'],
    [undefined, null],
    ['não é url', null]
  ])('recusa %s', (url, dev) => expect(isTrustedSender(url, dev)).toBe(false))
})
