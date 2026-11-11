/** Vagas guardadas (também servem de lista de IDs já vistos) e o histórico de varreduras. */
import type { Job, JobStatus, Match, ScanRecord } from '../../shared/types'
import { companyKey } from '../scan/filters'
import type { JsonFile } from '../store/jsonFile'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_SCAN_RECORDS = 50

export type NewJob = Omit<Job, 'status' | 'history' | 'notes' | 'match'>

export class JobsRepo {
  constructor(private readonly file: JsonFile<Job[]>) {}

  list(): Job[] {
    return this.file.read()
  }

  knownIds(): Set<string> {
    return new Set(this.list().map((j) => j.id))
  }

  /** Vagas guardadas por empresa nas últimas 24 h (anti-spam entre varreduras). */
  recentByCompany(now = Date.now()): Map<string, number> {
    const counts = new Map<string, number>()
    for (const job of this.list()) {
      if (now - Date.parse(job.foundAt) > DAY_MS) continue
      const key = companyKey(job.company)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }

  /** Acrescenta vagas novas na coluna "Nova" (IDs repetidos são ignorados). */
  add(items: readonly NewJob[]): Job[] {
    return this.file.update((current) => {
      const known = new Set(current.map((j) => j.id))
      const fresh: Job[] = items
        .filter((i) => !known.has(i.id))
        .map((i) => ({ ...i, status: 'nova', history: [{ status: 'nova', at: i.foundAt }], notes: '', match: null }))
      return [...fresh, ...current]
    })
  }

  move(id: string, status: JobStatus, at = new Date().toISOString()): Job[] {
    return this.change(id, (job) =>
      job.status === status ? job : { ...job, status, history: [...job.history, { status, at }] }
    )
  }

  setNotes(id: string, notes: string): Job[] {
    return this.change(id, (job) => ({ ...job, notes }))
  }

  setMatch(id: string, match: Match): Job[] {
    return this.change(id, (job) => ({ ...job, match }))
  }

  get(id: string): Job {
    const job = this.list().find((j) => j.id === id)
    if (!job) throw new Error('Vaga não encontrada.')
    return job
  }

  private change(id: string, edit: (job: Job) => Job): Job[] {
    return this.file.update((current) => {
      if (!current.some((j) => j.id === id)) throw new Error('Vaga não encontrada.')
      return current.map((j) => (j.id === id ? edit(j) : j))
    })
  }
}

export class ScanHistoryRepo {
  constructor(
    private readonly file: JsonFile<ScanRecord[]>,
    private readonly max = MAX_SCAN_RECORDS
  ) {}

  list(): ScanRecord[] {
    return this.file.read()
  }

  add(record: ScanRecord): ScanRecord[] {
    return this.file.update((current) => [record, ...current].slice(0, this.max))
  }
}
