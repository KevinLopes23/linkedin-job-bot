/** Tipos de domínio compartilhados entre main, preload e renderer. */

export type SearchKind = 'remoto' | 'local'
export type WorkModel = 'Remoto' | 'Híbrido' | 'Presencial' | 'Indefinido'

export const JOB_STATUSES = ['nova', 'salva', 'aplicada', 'entrevista', 'descartada'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Match {
  /** 0–100. */
  readonly score: number
  readonly strengths: readonly string[]
  readonly gaps: readonly string[]
  readonly summary: string
  readonly at: string
}

export interface StatusChange {
  readonly status: JobStatus
  readonly at: string
}

export interface Job {
  readonly id: string
  readonly title: string
  readonly company: string
  readonly location: string
  readonly model: WorkModel
  readonly link: string
  readonly searchKind: SearchKind
  readonly description: string
  readonly applicants: number | null
  readonly foundAt: string
  readonly status: JobStatus
  readonly history: readonly StatusChange[]
  readonly notes: string
  readonly match: Match | null
}

/** Qual IA dá a nota de match: Gemini (API Google, grátis) ou Claude local (CLI do Claude Code deste PC). */
export type AiEngineId = 'gemini' | 'claude'

export interface Settings {
  /** Motor de análise selecionado. */
  readonly aiEngine: AiEngineId
  /** Modelo do Claude local (haiku | sonnet | opus). */
  readonly claudeModel: string
  /** Palavras-chave das buscas no LinkedIn (uma busca remota e uma por cidade para cada). */
  readonly keywords: readonly string[]
  readonly searchRemote: boolean
  /** Cidades para vagas presenciais/híbridas, no formato do LinkedIn ("Bauru, São Paulo, Brasil"). */
  readonly cities: readonly string[]
  readonly hoursWindow: number
  readonly maxApplicants: number
  /** Descarta vagas com a descrição em inglês. */
  readonly onlyPortuguese: boolean
  /** Descarta vaga "Promovida por quem está contratando" (impulsionada pela empresa). */
  readonly skipPromoted: boolean
  readonly maxPerCompany: number
  /** Regex (uma por linha): o título precisa casar com pelo menos uma. */
  readonly titleTerms: readonly string[]
  /** Regex (uma por linha): título ou card que casar é descartado. */
  readonly excludeTerms: readonly string[]
  readonly delayMs: number
  readonly autoScan: boolean
  readonly intervalMinutes: number
  readonly notifyMinScore: number
  readonly maxAiPerScan: number
  readonly geminiModel: string
  readonly resumeText: string
}

export interface SettingsView extends Settings {
  readonly hasGeminiKey: boolean
  /** Há chave salva, mas o Windows não conseguiu decifrá-la (ex.: perfil do Windows trocado). */
  readonly geminiKeyUnreadable: boolean
}

/** Login opcional no LinkedIn (perfil do Chrome só do Vagalume). */
export interface LinkedInSessionView {
  readonly connected: boolean
  readonly connectedAt: string | null
  /** O LinkedIn pediu login de novo numa varredura: precisa reconectar. */
  readonly expired: boolean
  /** A janela de login está aberta agora. */
  readonly connecting: boolean
}

export type ScanStage ='buscando' | 'filtrando' | 'conferindo' | 'analisando'
export type LogLevel = 'info' | 'ok' | 'aviso' | 'erro'

export interface LogEntry {
  readonly at: string
  readonly level: LogLevel
  readonly message: string
}

export interface ScanStatus {
  readonly running: boolean
  readonly stage: ScanStage | null
  readonly message: string
  readonly progress: { readonly done: number; readonly total: number } | null
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly nextRunAt: string | null
  readonly log: readonly LogEntry[]
}

export interface ScanRecord {
  readonly startedAt: string
  readonly finishedAt: string
  /** Cards lidos nas páginas de busca. */
  readonly cards: number
  /** Vagas que passaram nos filtros do card. */
  readonly candidates: number
  /** Vagas novas aprovadas após conferir a página de cada uma. */
  readonly added: number
  readonly analyzed: number
  readonly error: string | null
}

export interface GeminiTestResult {
  readonly ok: boolean
  readonly message: string
}
