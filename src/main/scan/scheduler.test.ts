import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from './scheduler'

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-11T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('roda depois do intervalo e informa o horário', () => {
    const run = vi.fn()
    const s = new Scheduler(run)
    expect(s.schedule(true, 60)).toBe('2026-11-11T13:00:00.000Z')
    vi.advanceTimersByTime(59 * 60_000)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(run).toHaveBeenCalledOnce()
    expect(s.next()).toBeNull()
  })

  it('desligado não agenda', () => {
    const run = vi.fn()
    const s = new Scheduler(run)
    expect(s.schedule(false, 60)).toBeNull()
    vi.advanceTimersByTime(3 * 3600_000)
    expect(run).not.toHaveBeenCalled()
  })

  it('reagendar substitui o anterior', () => {
    const run = vi.fn()
    const s = new Scheduler(run)
    s.schedule(true, 60)
    s.schedule(true, 15)
    vi.advanceTimersByTime(3600_000)
    expect(run).toHaveBeenCalledOnce()
  })

  it('clear cancela', () => {
    const run = vi.fn()
    const s = new Scheduler(run)
    s.schedule(true, 15)
    s.clear()
    vi.advanceTimersByTime(3600_000)
    expect(run).not.toHaveBeenCalled()
  })
})
