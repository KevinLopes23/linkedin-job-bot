import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, hasNestedQuantifier, parseJobId, parseJobs, parseNotes, parseSettings, parseStatus, parseStoredSettings } from './validation'

describe('settings', () => {
  it('padrão = valores do bot antigo', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ hoursWindow: 1, maxApplicants: 50, maxPerCompany: 3, delayMs: 5000, intervalMinutes: 60 })
    expect(DEFAULT_SETTINGS.keywords).toContain('Desenvolvedor')
    expect(DEFAULT_SETTINGS.cities).toEqual(['Bauru, São Paulo, Brasil'])
  })

  it('arquivo vazio ou parcial completa com o padrão', () => {
    expect(parseStoredSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(parseStoredSettings({ maxApplicants: 10 }).maxApplicants).toBe(10)
  })

  it('arquivo inválido volta ao padrão', () => {
    expect(parseStoredSettings({ hoursWindow: -3 })).toEqual(DEFAULT_SETTINGS)
  })

  it('limpa listas: trim, sem vazios, sem repetidos', () => {
    const s = parseSettings({ ...DEFAULT_SETTINGS, keywords: [' Dev ', '', 'Dev', 'Node'] })
    expect(s.keywords).toEqual(['Dev', 'Node'])
  })

  it('recusa repetição dentro de repetição (ReDoS), aceita os termos padrão', () => {
    for (const bad of ['(a+)+$', String.raw`(\w*)*`, '(x|y+){2,}', '(?:ab+)*c']) expect(hasNestedQuantifier(bad)).toBe(true)
    for (const ok of [...DEFAULT_SETTINGS.titleTerms, ...DEFAULT_SETTINGS.excludeTerms, String.raw`(c\+\+)+`, '(react|vue)+']) {
      expect(hasNestedQuantifier(ok)).toBe(false)
    }
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, excludeTerms: ['(a+)+$'] })).toThrow(/repetição dentro de repetição/)
  })

  it('recusa regex inválida com mensagem clara', () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, excludeTerms: ['(senior'] })).toThrow(/expressão válida/)
  })

  it('exige palavra-chave e alguma localidade', () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, keywords: [' '] })).toThrow(/palavra-chave/)
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, searchRemote: false, cities: [] })).toThrow(/cidade/)
  })

  it('recusa intervalo abaixo de 15 min e nota fora de 0–100', () => {
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, intervalMinutes: 5 })).toThrow()
    expect(() => parseSettings({ ...DEFAULT_SETTINGS, notifyMinScore: 120 })).toThrow()
  })
})

describe('entradas do IPC', () => {
  it('id de vaga só com dígitos', () => {
    expect(parseJobId('4012345678')).toBe('4012345678')
    expect(() => parseJobId('../x')).toThrow()
  })
  it('status só das colunas do Kanban', () => {
    expect(parseStatus('entrevista')).toBe('entrevista')
    expect(() => parseStatus('contratado')).toThrow()
  })
  it('anotação com limite', () => {
    expect(parseNotes('ok')).toBe('ok')
    expect(() => parseNotes('x'.repeat(5001))).toThrow()
  })
})

describe('parseJobs', () => {
  it('descarta itens inválidos e mantém os bons', () => {
    const good = {
      id: '4012345678',
      title: 'Dev',
      company: 'Acme',
      location: 'Brasil',
      model: 'Remoto',
      link: 'https://br.linkedin.com/jobs/view/4012345678',
      searchKind: 'remoto',
      description: '',
      applicants: null,
      foundAt: '2026-11-11T10:00:00.000Z',
      status: 'nova',
      history: [{ status: 'nova', at: '2026-11-11T10:00:00.000Z' }],
      notes: '',
      match: null
    }
    expect(parseJobs([good, { id: 'x' }])).toEqual([good])
    expect(() => parseJobs({})).toThrow()
  })
})
