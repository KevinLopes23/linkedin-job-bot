/** Orquestra a varredura: buscando → filtrando → conferindo vagas → analisando com IA. */
import type { Job, LogLevel, Match, ScanRecord, ScanStage, ScanStatus, Settings } from '../../shared/types'
import { isFatalGeminiError } from '../ai/gemini'
import type { JobsRepo, NewJob, ScanHistoryRepo } from '../data/jobsRepo'
import { buildSearchUrls, compileTerms, limitPerCompany } from './filters'
import { checkDetail, dedupeById, isBlockedSearchPage, parseSearchHtml, type Candidate } from './parse'
import { Scheduler } from './scheduler'

const MAX_LOG_ENTRIES = 300
/** Intervalo entre chamadas ao Gemini (plano gratuito: ~15 por minuto). */
export const AI_CALL_GAP_MS = 4_500

export interface ScanBrowser {
  open(): Promise<void>
  searchHtml(url: string): Promise<string>
  detailHtml(url: string): Promise<string>
  close(): Promise<void>
  /** Abriu com a sessão do LinkedIn do usuário (depois do open). */
  readonly isLoggedIn?: boolean
  /** Aviso da abertura (ex.: a sessão não abriu e a varredura seguiu sem login). */
  readonly warning?: string | null
}

export interface Scorer {
  scoreJob(job: Job, resume: string): Promise<Match>
}

export interface ScanDeps {
  readonly createBrowser: () => ScanBrowser
  readonly jobs: JobsRepo
  readonly history: ScanHistoryRepo
  readonly settings: () => Settings
  /** Cliente de IA, ou null sem chave do Gemini. */
  readonly createScorer: (settings: Settings) => Scorer | null
  readonly onStatus: (status: ScanStatus) => void
  readonly onJobsChanged: (jobs: readonly Job[]) => void
  readonly onHistoryChanged: (history: readonly ScanRecord[]) => void
  /** Vagas novas já com a nota (quando houve análise) para notificar. */
  readonly onNewJobs: (jobs: readonly Job[]) => void
  readonly sleep?: (ms: number) => Promise<void>
}

const IDLE: ScanStatus = {
  running: false,
  stage: null,
  message: 'Parado',
  progress: null,
  startedAt: null,
  finishedAt: null,
  nextRunAt: null,
  log: []
}

class CancelledError extends Error {}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export class ScanService {
  private status: ScanStatus = IDLE
  private cancelRequested = false
  private disposed = false
  private readonly scheduler: Scheduler
  private readonly sleep: (ms: number) => Promise<void>
  private running: Promise<void> = Promise.resolve()
  /** Acorda a pausa em andamento quando o usuário pede para parar. */
  private wake: (() => void) | null = null

  constructor(private readonly deps: ScanDeps) {
    this.sleep = deps.sleep ?? defaultSleep
    this.scheduler = new Scheduler(() => this.start())
  }

  getStatus(): ScanStatus {
    return this.status
  }

  /** Inicia uma varredura. Retorna na hora; o progresso vem por eventos. */
  start(): ScanStatus {
    if (this.status.running || this.disposed) return this.status
    this.cancelRequested = false
    this.scheduler.clear()
    this.update({ ...IDLE, running: true, message: 'Iniciando varredura...', startedAt: new Date().toISOString() })
    this.running = this.runRound()
    return this.status
  }

  /** Espera a varredura em andamento terminar (usado nos testes). */
  whenIdle(): Promise<void> {
    return this.running
  }

  stop(): ScanStatus {
    if (this.status.running) {
      this.cancelRequested = true
      this.wake?.()
      this.update({ message: 'Parando após a etapa atual...' })
    }
    return this.status
  }

  reschedule(): void {
    if (this.disposed || this.status.running) return
    const { autoScan, intervalMinutes } = this.deps.settings()
    this.update({ nextRunAt: this.scheduler.schedule(autoScan, intervalMinutes) })
  }

  dispose(): void {
    this.disposed = true
    this.cancelRequested = true
    this.wake?.()
    this.scheduler.clear()
  }

  private async runRound(): Promise<void> {
    const settings = this.deps.settings()
    const record = { startedAt: this.status.startedAt ?? new Date().toISOString(), cards: 0, candidates: 0, added: 0, analyzed: 0 }
    let error: string | null = null
    const browser = this.deps.createBrowser()
    try {
      await browser.open()
      if (browser.warning) this.log('aviso', browser.warning)
      this.log(
        'info',
        browser.isLoggedIn
          ? 'Usando sua sessão do LinkedIn: o filtro remoto/presencial/híbrido é o do próprio LinkedIn.'
          : 'Sem login no LinkedIn: a busca mistura os modelos; só passa como remota a vaga que diz isso.'
      )
      const found = await this.search(browser, settings, record)
      const fresh = this.filter(found)
      record.candidates = fresh.length
      const approved = await this.verify(browser, fresh, settings)
      await browser.close()
      const added = this.save(approved, settings)
      record.added = added.length
      record.analyzed = await this.analyze(added, settings)
      const finalJobs = this.deps.jobs.list().filter((j) => added.some((a) => a.id === j.id))
      if (finalJobs.length > 0) this.deps.onNewJobs(finalJobs)
      this.finish(`Concluído: ${record.added} vaga(s) nova(s), ${record.analyzed} analisada(s) pela IA.`, 'ok')
    } catch (e) {
      if (e instanceof CancelledError) this.finish('Varredura interrompida.', 'aviso')
      else {
        error = errorText(e)
        this.finish(`Erro: ${error}`, 'erro')
      }
    } finally {
      await browser.close().catch(() => undefined)
      const history = this.deps.history.add({ ...record, finishedAt: new Date().toISOString(), error })
      this.deps.onHistoryChanged(history)
      this.reschedule()
    }
  }

  private async search(browser: ScanBrowser, settings: Settings, record: { cards: number }): Promise<Candidate[]> {
    const urls = buildSearchUrls(settings)
    const patterns = { title: compileTerms(settings.titleTerms), exclude: compileTerms(settings.excludeTerms) }
    const all: Candidate[] = []
    let failed = 0
    let lastError = ''
    for (const [index, search] of urls.entries()) {
      this.checkCancel()
      const where = search.kind === 'remoto' ? 'remoto (Brasil)' : search.city
      this.stage('buscando', `Buscando "${search.keyword}" · ${where}`, index, urls.length)
      try {
        const html = await browser.searchHtml(search.url)
        const result = parseSearchHtml(html, search, patterns)
        if (result.cards === 0 && isBlockedSearchPage(html)) {
          throw new Error('o LinkedIn não mostrou a lista de vagas (pediu login ou limitou o acesso)')
        }
        record.cards += result.cards
        all.push(...result.candidates)
        this.log('info', `"${search.keyword}" · ${where}: ${result.cards} card(s), ${result.candidates.length} no perfil.`)
      } catch (e) {
        failed++
        lastError = errorText(e)
        this.log('aviso', `"${search.keyword}" · ${where}: ${lastError}`)
      }
      if (index < urls.length - 1) await this.pause(settings.delayMs)
    }
    // Busca com erro e nenhum card lido: não é "sem vagas", é varredura que não funcionou.
    if (failed > 0 && record.cards === 0) {
      throw new Error(`Nenhuma busca respondeu (${failed} de ${urls.length} falharam). Último erro: ${lastError}`)
    }
    return all
  }

  private filter(found: readonly Candidate[]): Candidate[] {
    this.stage('filtrando', 'Filtrando repetidas e já vistas', 0, 1)
    const unique = dedupeById(found)
    const known = this.deps.jobs.knownIds()
    const fresh = unique.filter((c) => !known.has(c.id))
    this.log('info', `${unique.length} vaga(s) única(s) no perfil, ${fresh.length} ainda não vista(s).`)
    return fresh
  }

  private async verify(browser: ScanBrowser, candidates: readonly Candidate[], settings: Settings): Promise<NewJob[]> {
    const approved: NewJob[] = []
    for (const [index, candidate] of candidates.entries()) {
      this.checkCancel()
      this.stage('conferindo', `Conferindo ${candidate.title} · ${candidate.company}`, index, candidates.length)
      try {
        const verdict = checkDetail(await browser.detailHtml(candidate.link), candidate, settings.maxApplicants, settings.onlyPortuguese, settings.skipPromoted)
        if (verdict.ok) {
          approved.push({
            ...candidate,
            model: verdict.model,
            applicants: verdict.applicants,
            description: verdict.description,
            foundAt: new Date().toISOString()
          })
        } else {
          this.log('info', `Descartada: "${candidate.title}" (${candidate.company}) ${verdict.reason}.`)
        }
      } catch (e) {
        this.log('aviso', `Não deu para abrir "${candidate.title}": ${errorText(e)}. Ignorada por segurança.`)
      }
      if (index < candidates.length - 1) await this.pause(Math.round(settings.delayMs / 3))
    }
    return approved
  }

  private save(approved: readonly NewJob[], settings: Settings): NewJob[] {
    const { kept, dropped } = limitPerCompany(approved, this.deps.jobs.recentByCompany(), settings.maxPerCompany)
    for (const job of dropped) {
      this.log('info', `Anti-spam: "${job.company}" já tem ${settings.maxPerCompany} vaga(s) em 24 h. Ignorada: "${job.title}".`)
    }
    if (kept.length > 0) this.deps.onJobsChanged(this.deps.jobs.add(kept))
    return kept
  }

  private async analyze(added: readonly NewJob[], settings: Settings): Promise<number> {
    if (added.length === 0) return 0
    const scorer = this.deps.createScorer(settings)
    if (!scorer || !settings.resumeText.trim()) {
      this.log('info', 'Nota de match desligada: salve o currículo e a chave do Gemini em Configurações.')
      return 0
    }
    const queue = added.slice(0, settings.maxAiPerScan)
    if (queue.length < added.length) this.log('info', `IA: analisando ${queue.length} de ${added.length} (limite por varredura).`)
    let analyzed = 0
    for (const [index, item] of queue.entries()) {
      this.checkCancel()
      this.stage('analisando', `Analisando ${item.title}`, index, queue.length)
      try {
        const match = await scorer.scoreJob(this.deps.jobs.get(item.id), settings.resumeText)
        this.deps.onJobsChanged(this.deps.jobs.setMatch(item.id, match))
        analyzed++
      } catch (e) {
        const message = errorText(e)
        this.log('aviso', `IA: ${message}`)
        if (isFatalGeminiError(message)) break
      }
      if (index < queue.length - 1) await this.pause(AI_CALL_GAP_MS)
    }
    return analyzed
  }

  /** Pausa anti-rate-limit que termina na hora se o usuário pedir para parar. */
  private async pause(ms: number): Promise<void> {
    if (this.cancelRequested) throw new CancelledError('cancelado')
    await Promise.race([this.sleep(ms), new Promise<void>((resolve) => (this.wake = resolve))])
    this.wake = null
    this.checkCancel()
  }

  private checkCancel(): void {
    if (this.cancelRequested) throw new CancelledError('cancelado')
  }

  private stage(stage: ScanStage, message: string, done: number, total: number): void {
    this.update({ stage, message, progress: { done, total } })
  }

  private finish(message: string, level: LogLevel): void {
    this.log(level, message)
    this.update({ running: false, stage: null, progress: null, message, finishedAt: new Date().toISOString() })
  }

  private log(level: LogLevel, message: string): void {
    const entry = { at: new Date().toISOString(), level, message }
    this.update({ log: [...this.status.log, entry].slice(-MAX_LOG_ENTRIES) })
  }

  private update(patch: Partial<ScanStatus>): void {
    this.status = { ...this.status, ...patch }
    this.deps.onStatus(this.status)
  }
}
