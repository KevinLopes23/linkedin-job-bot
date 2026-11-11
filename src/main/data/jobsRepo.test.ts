import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Job, ScanRecord } from '../../shared/types'
import { JsonFile } from '../store/jsonFile'
import { JobsRepo, ScanHistoryRepo, type NewJob } from './jobsRepo'
import { parseJobs, parseScanHistory } from './validation'

let dir = ''
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const repo = (): JobsRepo => {
  dir = mkdtempSync(join(tmpdir(), 'vagalume-jobs-'))
  return new JobsRepo(new JsonFile<Job[]>(join(dir, 'jobs.json'), parseJobs, () => []))
}

const newJob = (id: string, company = 'Acme', foundAt = new Date().toISOString()): NewJob => ({
  id,
  title: 'Desenvolvedor',
  company,
  location: 'Brasil',
  model: 'Remoto',
  link: `https://br.linkedin.com/jobs/view/${id}`,
  searchKind: 'remoto',
  description: '',
  applicants: null,
  foundAt
})

describe('JobsRepo', () => {
  it('adiciona na coluna Nova, com histórico, e não repete IDs', () => {
    const r = repo()
    r.add([newJob('4000000001')])
    const list = r.add([newJob('4000000001'), newJob('4000000002')])
    expect(list.map((j) => j.id)).toEqual(['4000000002', '4000000001'])
    expect(list[1]).toMatchObject({ status: 'nova', notes: '', match: null })
    expect(list[1]?.history).toHaveLength(1)
    expect(r.knownIds()).toEqual(new Set(['4000000001', '4000000002']))
  })

  it('move de coluna gravando a data, e ignora mover para a mesma coluna', () => {
    const r = repo()
    r.add([newJob('4000000001')])
    r.move('4000000001', 'salva', '2026-11-11T12:00:00.000Z')
    r.move('4000000001', 'salva', '2026-11-11T13:00:00.000Z')
    const job = r.move('4000000001', 'aplicada', '2026-11-11T14:00:00.000Z')[0]
    expect(job?.status).toBe('aplicada')
    expect(job?.history.map((h) => [h.status, h.at])).toEqual([
      ['nova', job?.foundAt],
      ['salva', '2026-11-11T12:00:00.000Z'],
      ['aplicada', '2026-11-11T14:00:00.000Z']
    ])
  })

  it('anotações e nota de match persistem', () => {
    const r = repo()
    r.add([newJob('4000000001')])
    r.setNotes('4000000001', 'Falar com a Ana')
    r.setMatch('4000000001', { score: 82, strengths: ['React'], gaps: [], summary: 'Vale aplicar', at: '2026-11-11T10:00:00.000Z' })
    expect(r.get('4000000001')).toMatchObject({ notes: 'Falar com a Ana', match: { score: 82 } })
  })

  it('erro claro para vaga inexistente', () => {
    expect(() => repo().move('4000000999', 'salva')).toThrow(/não encontrada/)
  })

  it('conta por empresa só as últimas 24 h', () => {
    const r = repo()
    const now = Date.parse('2026-11-11T12:00:00.000Z')
    r.add([
      newJob('4000000001', 'Acme', '2026-11-11T10:00:00.000Z'),
      newJob('4000000002', 'ACME', '2026-11-11T09:00:00.000Z'),
      newJob('4000000003', 'Acme', '2026-11-09T09:00:00.000Z')
    ])
    expect(r.recentByCompany(now).get('acme')).toBe(2)
  })
})

describe('ScanHistoryRepo', () => {
  it('guarda só as últimas N (padrão 50), a mais nova primeiro', () => {
    dir = mkdtempSync(join(tmpdir(), 'vagalume-scans-'))
    const file = new JsonFile<ScanRecord[]>(join(dir, 'scans.json'), parseScanHistory, () => [])
    const h = new ScanHistoryRepo(file, 3)
    for (let i = 0; i < 5; i++) {
      h.add({ startedAt: `t${i}`, finishedAt: `t${i}`, cards: i, candidates: 0, added: 0, analyzed: 0, error: null })
    }
    expect(h.list().map((r) => r.cards)).toEqual([4, 3, 2])
  })
})
