import { describe, expect, it } from 'vitest'
import { assertSearchStatus } from './linkedin'

describe('assertSearchStatus', () => {
  it('2xx/3xx e sem resposta passam', () => {
    expect(() => assertSearchStatus(200)).not.toThrow()
    expect(() => assertSearchStatus(302)).not.toThrow()
    expect(() => assertSearchStatus(null)).not.toThrow()
  })

  it('429 explica o limite; 999 e 403 também falham', () => {
    expect(() => assertSearchStatus(429)).toThrow(/HTTP 429 \(muitas buscas seguidas/)
    expect(() => assertSearchStatus(999)).toThrow(/HTTP 999/)
    expect(() => assertSearchStatus(403)).toThrow(/HTTP 403/)
  })
})
