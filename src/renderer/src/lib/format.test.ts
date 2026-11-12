import { describe, expect, it } from 'vitest'
import { errorMessage, glow, matchesModel, modelLabel, scoreTone, sessionLabel, timeAgo, timeUntil } from './format'

const now = Date.parse('2026-11-11T12:00:00.000Z')

describe('format', () => {
  it('timeAgo', () => {
    expect(timeAgo('2026-11-11T11:59:40.000Z', now)).toBe('agora')
    expect(timeAgo('2026-11-11T11:55:00.000Z', now)).toBe('há 5 min')
    expect(timeAgo('2026-11-11T09:00:00.000Z', now)).toBe('há 3 h')
    expect(timeAgo('2026-11-09T12:00:00.000Z', now)).toBe('há 2 dias')
  })

  it('timeUntil', () => {
    expect(timeUntil('2026-11-11T12:12:00.000Z', now)).toBe('em 12 min')
    expect(timeUntil('2026-11-11T13:05:00.000Z', now)).toBe('em 1 h 05')
    expect(timeUntil('2026-11-11T14:00:00.000Z', now)).toBe('em 2 h')
  })

  it('tom e brilho pela nota', () => {
    expect(scoreTone(null)).toBe('sem')
    expect(scoreTone(80)).toBe('alto')
    expect(scoreTone(60)).toBe('medio')
    expect(scoreTone(30)).toBe('baixo')
    expect(glow(null)).toBe(0)
    expect(glow(30)).toBe(0)
    expect(glow(95)).toBe(1)
    expect(glow(70)).toBeGreaterThan(glow(55))
  })

  it('limpa o prefixo do erro do IPC', () => {
    expect(errorMessage(new Error("Error invoking remote method 'jobs:move': Error: Coluna inválida."))).toBe('Coluna inválida.')
  })

  it('estado do login do LinkedIn em texto', () => {
    const base = { connected: false, connectedAt: null, expired: false, connecting: false }
    expect(sessionLabel(null)).toBe('Verificando…')
    expect(sessionLabel(base)).toMatch(/^Não conectado/)
    expect(sessionLabel({ ...base, connecting: true })).toMatch(/janela de login/i)
    expect(sessionLabel({ ...base, connected: true, connectedAt: '2026-11-12T13:30:00.000Z' })).toMatch(/^Conectado em \d{2}\/11\/2026/)
    expect(sessionLabel({ ...base, expired: true, connectedAt: '2026-11-12T13:30:00.000Z' })).toMatch(/expirou/)
  })

  it('vaga da cidade sem modelo escrito aparece como "Presencial ou híbrido" e nos dois filtros (B2)', () => {
    expect(modelLabel('Indefinido')).toBe('Presencial ou híbrido')
    expect(modelLabel('Remoto')).toBe('Remoto')
    expect(matchesModel('Indefinido', 'Presencial')).toBe(true)
    expect(matchesModel('Indefinido', 'Híbrido')).toBe(true)
    expect(matchesModel('Indefinido', 'Remoto')).toBe(false)
    expect(matchesModel('Híbrido', 'Presencial')).toBe(false)
  })
})
