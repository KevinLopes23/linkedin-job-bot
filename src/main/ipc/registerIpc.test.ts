import { describe, expect, it } from 'vitest'
import { requireLinkedInUrl } from './registerIpc'

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
