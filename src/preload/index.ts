import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type VagalumeApi } from '../shared/ipc'

const invoke =
  <R>(channel: string) =>
  (...args: unknown[]): Promise<R> =>
    ipcRenderer.invoke(channel, ...args) as Promise<R>

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: VagalumeApi = {
  settings: {
    get: invoke(IPC.settingsGet),
    save: invoke(IPC.settingsSave),
    setGeminiKey: invoke(IPC.settingsSetGeminiKey),
    clearGeminiKey: invoke(IPC.settingsClearGeminiKey),
    testGemini: invoke(IPC.settingsTestGemini),
    importResumePdf: invoke(IPC.settingsImportResume)
  },
  jobs: {
    list: invoke(IPC.jobsList),
    move: invoke(IPC.jobsMove),
    setNotes: invoke(IPC.jobsSetNotes),
    analyze: invoke(IPC.jobsAnalyze),
    onChange: (listener) => subscribe(IPC.jobsChanged, listener)
  },
  scan: {
    status: invoke(IPC.scanStatus),
    history: invoke(IPC.scanHistory),
    start: invoke(IPC.scanStart),
    stop: invoke(IPC.scanStop),
    onStatus: (listener) => subscribe(IPC.scanChanged, listener),
    onHistory: (listener) => subscribe(IPC.scanHistoryChanged, listener)
  },
  app: {
    version: invoke(IPC.appVersion),
    openExternal: invoke(IPC.appOpenExternal),
    onNavigate: (listener) => subscribe(IPC.appNavigate, listener)
  }
}

contextBridge.exposeInMainWorld('vagalume', api)
