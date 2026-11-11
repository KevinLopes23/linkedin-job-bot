/** Registro dos handlers IPC. Toda entrada vinda do renderer é validada aqui. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import type { GeminiTestResult, Job } from '../../shared/types'
import { GeminiClient } from '../ai/gemini'
import type { JobsRepo, ScanHistoryRepo } from '../data/jobsRepo'
import { parseJobId, parseNotes, parseStatus } from '../data/validation'
import type { ScanService } from '../scan/scanService'
import { pdfToText } from '../settings/resumePdf'
import type { SettingsService } from '../settings/settingsService'

export interface IpcDeps {
  readonly settings: SettingsService
  readonly jobs: JobsRepo
  readonly history: ScanHistoryRepo
  readonly scan: ScanService
  readonly onJobsChanged: (jobs: readonly Job[]) => void
}

/** URL file:// sem query/hash, em minúsculas (caminho do Windows não diferencia maiúsculas). */
const normalizeFileUrl = (url: URL): string => `${url.protocol}//${url.host}${url.pathname}`.toLowerCase()

/**
 * Só a página do próprio app chama o IPC: exatamente o index.html do app (file://, sem host de rede)
 * ou a origem do dev server. Defesa em profundidade caso um dia entre iframe/webview na janela.
 */
export function isTrustedSender(url: string | undefined, devOrigin: string | null, appIndexUrl: string): boolean {
  if (!url || !URL.canParse(url)) return false
  const parsed = new URL(url)
  if (parsed.protocol === 'file:') {
    return parsed.host === '' && normalizeFileUrl(parsed) === normalizeFileUrl(new URL(appIndexUrl))
  }
  return devOrigin !== null && parsed.origin === devOrigin
}

/** Só abre links https do LinkedIn. */
export function requireLinkedInUrl(value: unknown): string {
  if (typeof value !== 'string' || !URL.canParse(value)) throw new Error('Link inválido.')
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  const ok = url.protocol === 'https:' && (host === 'linkedin.com' || host.endsWith('.linkedin.com'))
  if (!ok) throw new Error('Só é possível abrir links do LinkedIn.')
  return url.toString()
}

async function testGemini(settings: SettingsService): Promise<GeminiTestResult> {
  const key = settings.getGeminiKey()
  if (!key) return { ok: false, message: 'Nenhuma chave salva.' }
  try {
    await new GeminiClient(key, settings.get().geminiModel).test()
    return { ok: true, message: `Gemini respondeu (modelo ${settings.get().geminiModel}).` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function importResumePdf(): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const options = { title: 'Escolha o currículo em PDF', filters: [{ name: 'PDF', extensions: ['pdf'] }], properties: ['openFile' as const] }
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  const path = result.filePaths[0]
  if (result.canceled || !path) return null
  return pdfToText(new Uint8Array(await readFile(path)))
}

async function analyzeOne({ settings, jobs }: IpcDeps, id: string): Promise<readonly Job[]> {
  const key = settings.getGeminiKey()
  const { resumeText, geminiModel } = settings.get()
  if (!key || !resumeText.trim()) throw new Error('Salve o currículo e a chave do Gemini em Configurações.')
  const match = await new GeminiClient(key, geminiModel).scoreJob(jobs.get(id), resumeText)
  return jobs.setMatch(id, match)
}

export function registerIpc(deps: IpcDeps): void {
  const { settings, jobs, history, scan, onJobsChanged } = deps
  const devUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const devOrigin = devUrl && URL.canParse(devUrl) ? new URL(devUrl).origin : null
  // Mesmo caminho que o index.ts usa no loadFile.
  const appIndexUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href
  const handle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event.senderFrame?.url, devOrigin, appIndexUrl)) throw new Error('Chamada de origem não autorizada.')
      return listener(event, ...args)
    })
  }
  const changed = (list: readonly Job[]): readonly Job[] => {
    onJobsChanged(list)
    return list
  }

  handle(IPC.settingsGet, () => settings.view())
  handle(IPC.settingsSave, (_e, raw: unknown) => settings.save(raw))
  handle(IPC.settingsSetGeminiKey, (_e, key: unknown) => settings.setGeminiKey(key))
  handle(IPC.settingsClearGeminiKey, () => settings.clearGeminiKey())
  handle(IPC.settingsTestGemini, () => testGemini(settings))
  handle(IPC.settingsImportResume, () => importResumePdf())

  handle(IPC.jobsList, () => jobs.list())
  handle(IPC.jobsMove, (_e, id: unknown, status: unknown) => changed(jobs.move(parseJobId(id), parseStatus(status))))
  handle(IPC.jobsSetNotes, (_e, id: unknown, notes: unknown) => changed(jobs.setNotes(parseJobId(id), parseNotes(notes))))
  handle(IPC.jobsAnalyze, async (_e, id: unknown) => changed(await analyzeOne(deps, parseJobId(id))))

  handle(IPC.scanStatus, () => scan.getStatus())
  handle(IPC.scanHistory, () => history.list())
  handle(IPC.scanStart, () => scan.start())
  handle(IPC.scanStop, () => scan.stop())

  handle(IPC.appVersion, () => app.getVersion())
  handle(IPC.appOpenExternal, (_e, url: unknown) => shell.openExternal(requireLinkedInUrl(url)))
}
