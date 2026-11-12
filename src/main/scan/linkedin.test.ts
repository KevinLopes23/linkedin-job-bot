import { describe, expect, it } from 'vitest'
import { buildSearchUrls } from './filters'
import { assertSearchStatus, isCitySearch } from './linkedin'

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

describe('isCitySearch', () => {
  it('busca por cidade (location=) vai pela página pública mesmo logado; a remota (geoId) vai logada', () => {
    const [remote, city] = buildSearchUrls({ keywords: ['Dev'], searchRemote: true, cities: ['Bauru, São Paulo, Brasil'], hoursWindow: 24 })
    expect(isCitySearch(remote?.url ?? '')).toBe(false)
    expect(isCitySearch(city?.url ?? '')).toBe(true)
  })
})
