import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Job, ScanRecord, ScanStatus, Settings } from '../../shared/types'
import { JobsRepo, ScanHistoryRepo } from '../data/jobsRepo'
import { DEFAULT_SETTINGS, parseJobs, parseScanHistory } from '../data/validation'
import { JsonFile } from '../store/jsonFile'
import { detailPage, searchPage } from './fixtures'
import { ScanService, type ScanBrowser, type Scorer } from './scanService'

let dir = ''
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const settings: Settings = { ...DEFAULT_SETTINGS, keywords: ['Desenvolvedor'], cities: [], maxPerCompany: 1, autoScan: false, resumeText: 'React, Node' }

function setup(
  opts: { scorer?: Scorer | null; browser?: Partial<ScanBrowser>; sleep?: (ms: number) => Promise<void>; settings?: Partial<Settings> } = {}
) {
  dir = mkdtempSync(join(tmpdir(), 'vagalume-scan-'))
  const jobs = new JobsRepo(new JsonFile<Job[]>(join(dir, 'jobs.json'), parseJobs, () => []))
  const history = new ScanHistoryRepo(new JsonFile<ScanRecord[]>(join(dir, 'scans.json'), parseScanHistory, () => []))
  const browser: ScanBrowser = {
    open: async () => undefined,
    close: async () => undefined,
    searchHtml: async () =>
      searchPage([
        { id: '4000000001', title: 'Desenvolvedor React', company: 'Acme', location: 'Brasil (Remoto)' },
        { id: '4000000002', title: 'Desenvolvedor Node', company: 'Acme', location: 'Brasil (Remoto)' },
        { id: '4000000003', title: 'Desenvolvedor Vue', company: 'Beta', location: 'Brasil (Remoto)' },
        { id: '4000000004', title: 'Desenvolvedor Java', company: 'Gama', location: 'Brasil (Remoto)' }
      ]),
    detailHtml: async (url) => detailPage({ body: url.includes('4000000003') ? 'Híbrido' : 'Remoto · 10 candidaturas' }),
    ...opts.browser
  }
  const statuses: ScanStatus[] = []
  const newJobs = vi.fn()
  const createBrowser = vi.fn(() => browser)
  const service = new ScanService({
    createBrowser,
    jobs,
    history,
    settings: () => ({ ...settings, ...opts.settings }),
    createScorer: () => (opts.scorer === undefined ? null : opts.scorer),
    onStatus: (s) => statuses.push(s),
    onJobsChanged: () => undefined,
    onHistoryChanged: () => undefined,
    onNewJobs: newJobs,
    sleep: opts.sleep ?? (async () => undefined)
  })
  return { service, jobs, history, statuses, newJobs, createBrowser }
}

describe('ScanService', () => {
  it('busca, filtra, confere, aplica anti-spam e guarda', async () => {
    const { service, jobs, history, statuses } = setup()
    service.start()
    await service.whenIdle()
    // 4000000004 (Java) cai no filtro; 4000000003 é híbrida na página; 4000000002 cai no anti-spam (Acme, máx. 1).
    expect(jobs.list().map((j) => j.id)).toEqual(['4000000001'])
    expect(jobs.list()[0]).toMatchObject({ applicants: 10, model: 'Remoto', status: 'nova' })
    expect(history.list()[0]).toMatchObject({ candidates: 3, added: 1, analyzed: 0, error: null })
    const stages = [...new Set(statuses.map((s) => s.stage).filter(Boolean))]
    expect(stages).toEqual(['buscando', 'filtrando', 'conferindo'])
    expect(service.getStatus().running).toBe(false)
  })

  it('não repete vaga já vista na varredura seguinte', async () => {
    const { service, history } = setup()
    service.start()
    await service.whenIdle()
    service.start()
    await service.whenIdle()
    expect(history.list()[0]).toMatchObject({ added: 0 })
  })

  it('com IA: dá nota às novas e avisa quem notifica', async () => {
    const scorer: Scorer = { scoreJob: vi.fn(async () => ({ score: 88, strengths: ['React'], gaps: [], summary: 'Vale', at: 'x' })) }
    const { service, jobs, newJobs, statuses } = setup({ scorer })
    service.start()
    await service.whenIdle()
    expect(jobs.list()[0]?.match?.score).toBe(88)
    expect(newJobs).toHaveBeenCalledWith([expect.objectContaining({ id: '4000000001', match: expect.objectContaining({ score: 88 }) })])
    expect(statuses.some((s) => s.stage === 'analisando')).toBe(true)
  })

  it('IA com erro fatal para de chamar e a varredura termina bem', async () => {
    const scoreJob = vi.fn(async () => {
      throw new Error('Limite do Gemini atingido.')
    })
    const { service, history } = setup({ scorer: { scoreJob } })
    service.start()
    await service.whenIdle()
    expect(scoreJob).toHaveBeenCalledOnce()
    expect(history.list()[0]).toMatchObject({ added: 1, analyzed: 0, error: null })
  })

  it('falha do navegador vira erro no histórico, sem derrubar o app', async () => {
    const { service, history } = setup({
      browser: {
        open: async () => {
          throw new Error('Nem Google Chrome nem Microsoft Edge foram encontrados.')
        }
      }
    })
    service.start()
    await service.whenIdle()
    expect(history.list()[0]?.error).toMatch(/Chrome/)
    expect(service.getStatus()).toMatchObject({ running: false })
  })

  it('parar interrompe e registra', async () => {
    const { service, history } = setup()
    service.start()
    service.stop()
    await service.whenIdle()
    expect(service.getStatus().message).toBe('Varredura interrompida.')
    expect(history.list()).toHaveLength(1)
  })

  it('todas as buscas falhando vira erro, não "Concluído: 0 vagas" (M1)', async () => {
    const { service, history } = setup({
      browser: {
        searchHtml: async () => {
          throw new Error('net::ERR_INTERNET_DISCONNECTED')
        }
      }
    })
    service.start()
    await service.whenIdle()
    expect(history.list()[0]?.error).toMatch(/Nenhuma busca respondeu \(1 de 1 falharam\).*ERR_INTERNET_DISCONNECTED/)
    expect(service.getStatus().message).toMatch(/^Erro:/)
  })

  it('busca sem resultado (0 cards, sem erro) continua sendo "Concluído"', async () => {
    const { service, history } = setup({ browser: { searchHtml: async () => searchPage([]) } })
    service.start()
    await service.whenIdle()
    expect(history.list()[0]).toMatchObject({ cards: 0, error: null })
  })

  it('"Parar" interrompe a pausa entre buscas na hora', async () => {
    const never = (): Promise<void> => new Promise(() => undefined)
    const { service, history } = setup({ sleep: never, settings: { keywords: ['Dev', 'Node'] }, browser: { searchHtml: async () => searchPage([]) } })
    service.start()
    await vi.waitFor(() => expect(service.getStatus().log.length).toBeGreaterThan(0))
    service.stop()
    await service.whenIdle()
    expect(service.getStatus().message).toBe('Varredura interrompida.')
    expect(history.list()).toHaveLength(1)
  })

  it('start em dobro durante a varredura não abre outro navegador', async () => {
    const { service, createBrowser, history } = setup()
    service.start()
    service.start()
    await service.whenIdle()
    service.start()
    await service.whenIdle()
    expect(createBrowser).toHaveBeenCalledTimes(2)
    expect(history.list()).toHaveLength(2)
  })
})
