import { describe, expect, it } from 'vitest'
import { DEFAULT_EXCLUDE_TERMS, DEFAULT_TITLE_TERMS } from '../scan/filters'
import { hasNestedQuantifier, isSlowRegex } from './regexSafety'

const DEFAULTS = [...DEFAULT_TITLE_TERMS, ...DEFAULT_EXCLUDE_TERMS]

describe('hasNestedQuantifier', () => {
  it.each(['(a+)+$', String.raw`(\w*)*`, '(x|y+){2,}', '(?:ab+)*c', '((ab)+)+', '((a+)b)*', '(a{1,5})+'])('recusa %s', (re) =>
    expect(hasNestedQuantifier(re)).toBe(true)
  )

  it.each(['(a{2})+', '(react|vue)+', String.raw`(c\+\+)+`, '[(a+)]+', String.raw`\(a+\)+`, '(a+)?', '(ab)+'])('aceita %s', (re) =>
    expect(hasNestedQuantifier(re)).toBe(false)
  )
})

describe('isSlowRegex', () => {
  it('pega a alternância que se sobrepõe, (a|aa)+$, que o detector estático não vê', () => {
    expect(hasNestedQuantifier('(a|aa)+$')).toBe(false)
    expect(isSlowRegex('(a|aa)+$')).toBe(true)
  })

  it('termo comum é rápido', () => {
    expect(isSlowRegex(String.raw`\bdesenvolvedor`)).toBe(false)
    expect(isSlowRegex('(react|vue)+')).toBe(false)
  })

  it('usa o relógio injetado: lento duas vezes seguidas recusa; uma pausa isolada não', () => {
    let t = 0
    expect(isSlowRegex('abc', () => (t += 30))).toBe(true)
    let calls = 0
    // só a 1ª medição (2 leituras do relógio) é lenta; a repetição é rápida
    const onceSlow = (): number => (++calls <= 2 ? calls * 40 : 80 + calls)
    expect(isSlowRegex('abc', onceSlow)).toBe(false)
  })
})

describe('termos padrão do bot', () => {
  it('todos aceitos, e a checagem inteira é rápida', () => {
    const start = performance.now()
    expect(DEFAULTS.filter((t) => hasNestedQuantifier(t) || isSlowRegex(t))).toEqual([])
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
