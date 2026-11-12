import { join } from 'node:path'
import { app, BrowserWindow, Menu, nativeImage, Notification, session, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import { IPC, type PageId } from '../shared/ipc'
import type { Job, ScanRecord, Settings } from '../shared/types'
import { createScorer } from './ai/scorer'
import { JobsRepo, ScanHistoryRepo } from './data/jobsRepo'
import { DEFAULT_SETTINGS, parseJobs, parseScanHistory, parseStoredSettings } from './data/validation'
import { registerIpc } from './ipc/registerIpc'
import { launchProfile, LinkedInBrowser } from './scan/linkedin'
import { ScanService } from './scan/scanService'
import { LinkedInSession } from './scan/session'
import { parseSecrets, SettingsService, type Secrets } from './settings/settingsService'
import { JsonFile } from './store/jsonFile'

const APP_ID = 'br.kevma.vagalume'
const WINDOW_SIZE = { width: 1360, height: 880, minWidth: 1040, minHeight: 680 }
const BACKGROUND_COLOR = '#05070f'
const MAX_NOTIFICATIONS_PER_SCAN = 3

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

const send = (channel: string, value: unknown): void => {
  mainWindow?.webContents.send(channel, value)
}

const dataDir = app.getPath('userData')
const file = <T>(name: string, parse: (raw: unknown) => T, fallback: () => T): JsonFile<T> =>
  new JsonFile(join(dataDir, name), parse, fallback)

const settings = new SettingsService(
  file<Settings>('settings.json', parseStoredSettings, () => DEFAULT_SETTINGS),
  file<Secrets>('secrets.json', parseSecrets, () => ({})),
  () => scan.reschedule()
)
const jobs = new JobsRepo(file<Job[]>('jobs.json', parseJobs, () => []))
const history = new ScanHistoryRepo(file<ScanRecord[]>('scans.json', parseScanHistory, () => []))

function showWindow(page?: PageId): void {
  if (!mainWindow) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  if (page) send(IPC.appNavigate, page)
}

function notifyNewJobs(items: readonly Job[]): void {
  if (!Notification.isSupported()) return
  const minScore = settings.get().notifyMinScore
  const best = items
    .filter((j) => j.match !== null && j.match.score >= minScore)
    .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
    .slice(0, MAX_NOTIFICATIONS_PER_SCAN)
  for (const job of best) {
    const n = new Notification({
      title: `Vaga acesa · match ${job.match?.score}`,
      body: `${job.title} · ${job.company}\n${job.match?.summary ?? ''}`,
      icon
    })
    n.on('click', () => showWindow('vagas'))
    n.show()
  }
}

/** Login opcional: perfil do Chrome só do Vagalume, separado do Chrome do usuário. */
const linkedin = new LinkedInSession(join(dataDir, 'linkedin-profile'), launchProfile)

const scan = new ScanService({
  createBrowser: () => new LinkedInBrowser({ profileDir: linkedin.activeProfile(), onLoggedOut: () => linkedin.markExpired() }),
  jobs,
  history,
  settings: () => settings.get(),
  createScorer: (s) => createScorer(s, () => settings.getGeminiKey()),
  onStatus: (status) => {
    send(IPC.scanChanged, status)
    tray?.setToolTip(status.running ? `Vagalume · ${status.message}` : 'Vagalume')
  },
  onJobsChanged: (list) => send(IPC.jobsChanged, list),
  onHistoryChanged: (list) => send(IPC.scanHistoryChanged, list),
  onNewJobs: notifyNewJobs
})

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...WINDOW_SIZE,
    show: false,
    title: 'Vagalume',
    icon,
    backgroundColor: BACKGROUND_COLOR,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())
  // Fechar a janela só esconde: o app segue na bandeja varrendo no horário.
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  // A janela nunca navega para fora nem abre pop-ups; links vão pelo IPC (só LinkedIn).
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const devOrigin = devServerUrl ? new URL(devServerUrl).origin : null
  window.webContents.on('will-navigate', (event, url) => {
    const isDevReload = devOrigin !== null && URL.canParse(url) && new URL(url).origin === devOrigin
    if (!isDevReload) event.preventDefault()
  })
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
  return window
}

function createTray(): Tray {
  const t = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
  t.setToolTip('Vagalume')
  t.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Vagalume', click: () => showWindow() },
      { label: 'Varrer agora', click: () => (scan.start(), showWindow('varredura')) },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  t.on('click', () => showWindow())
  return t
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.setAppUserModelId(APP_ID)

  app.whenReady().then(() => {
    // O app não precisa de câmera, microfone, localização etc.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    registerIpc({ settings, jobs, history, scan, linkedin, onJobsChanged: (list) => send(IPC.jobsChanged, list) })
    mainWindow = createWindow()
    tray = createTray()
    scan.reschedule()
  })

  app.on('before-quit', () => {
    quitting = true
    scan.dispose()
  })

  // Com a janela escondida o app continua na bandeja; só sai pelo menu "Sair".
  app.on('window-all-closed', () => undefined)
}
