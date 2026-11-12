/** Contrato IPC compartilhado entre main, preload e renderer. */
import type { GeminiTestResult, Job, JobStatus, LinkedInSessionView, ScanRecord, ScanStatus, Settings, SettingsView } from './types'

type Listener<T> = (value: T) => void
type Unsubscribe = () => void

export type PageId = 'inicio' | 'vagas' | 'candidaturas' | 'varredura' | 'configuracoes'

export interface VagalumeApi {
  readonly settings: {
    get(): Promise<SettingsView>
    save(settings: Settings): Promise<SettingsView>
    setGeminiKey(key: string): Promise<SettingsView>
    clearGeminiKey(): Promise<SettingsView>
    testGemini(): Promise<GeminiTestResult>
    /** Abre o seletor de arquivo e devolve o texto do PDF (null se cancelado). */
    importResumePdf(): Promise<string | null>
  }
  readonly jobs: {
    list(): Promise<readonly Job[]>
    move(id: string, status: JobStatus): Promise<readonly Job[]>
    setNotes(id: string, notes: string): Promise<readonly Job[]>
    /** Calcula (ou recalcula) a nota de match de uma vaga com o Gemini. */
    analyze(id: string): Promise<readonly Job[]>
    onChange(listener: Listener<readonly Job[]>): Unsubscribe
  }
  readonly scan: {
    status(): Promise<ScanStatus>
    history(): Promise<readonly ScanRecord[]>
    start(): Promise<ScanStatus>
    stop(): Promise<ScanStatus>
    onStatus(listener: Listener<ScanStatus>): Unsubscribe
    onHistory(listener: Listener<readonly ScanRecord[]>): Unsubscribe
  }
  readonly linkedin: {
    status(): Promise<LinkedInSessionView>
    /** Abre a janela de login e resolve quando o usuário entra (ou falha se fechar a janela). */
    connect(): Promise<LinkedInSessionView>
    disconnect(): Promise<LinkedInSessionView>
  }
  readonly app: {
    version(): Promise<string>
    /** Abre a vaga no navegador padrão (só links do LinkedIn). */
    openExternal(url: string): Promise<void>
    onNavigate(listener: Listener<PageId>): Unsubscribe
  }
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsSetGeminiKey: 'settings:set-gemini-key',
  settingsClearGeminiKey: 'settings:clear-gemini-key',
  settingsTestGemini: 'settings:test-gemini',
  settingsImportResume: 'settings:import-resume',
  jobsList: 'jobs:list',
  jobsMove: 'jobs:move',
  jobsSetNotes: 'jobs:set-notes',
  jobsAnalyze: 'jobs:analyze',
  jobsChanged: 'jobs:changed',
  scanStatus: 'scan:status',
  scanHistory: 'scan:history',
  scanStart: 'scan:start',
  scanStop: 'scan:stop',
  scanChanged: 'scan:changed',
  scanHistoryChanged: 'scan:history-changed',
  linkedinStatus: 'linkedin:status',
  linkedinConnect: 'linkedin:connect',
  linkedinDisconnect: 'linkedin:disconnect',
  appVersion: 'app:version',
  appOpenExternal: 'app:open-external',
  appNavigate: 'app:navigate'
} as const
