import { useEffect, useState } from 'react'
import type { Job, ScanRecord, ScanStatus, SettingsView } from '../../../shared/types'
import { errorMessage } from '../lib/format'

export interface Live<T> {
  readonly data: T | null
  readonly setData: (value: T) => void
  /** Falha da carga (ex.: arquivo bloqueado pelo antivírus). Nunca vira "lista vazia" calada. */
  readonly error: string | null
  readonly retry: () => void
}

/** Carga inicial + atualização por evento vindo do processo principal. */
function useLive<T>(load: () => Promise<T>, subscribe: ((listener: (value: T) => void) => () => void) | null): Live<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let gotEvent = false
    const off = subscribe?.((value) => {
      gotEvent = true
      if (!active) return
      setData(value)
      setError(null)
    })
    load().then(
      (value) => {
        // Se um evento chegou antes, ele é mais novo que a carga.
        if (!active || gotEvent) return
        setData(value)
        setError(null)
      },
      (e: unknown) => {
        if (active) setError(errorMessage(e))
      }
    )
    return () => {
      active = false
      off?.()
    }
  }, [load, subscribe, attempt])

  return { data, setData, error, retry: () => setAttempt((n) => n + 1) }
}

export const useJobs = (): Live<readonly Job[]> => useLive(window.vagalume.jobs.list, window.vagalume.jobs.onChange)
export const useScanStatus = (): Live<ScanStatus> => useLive(window.vagalume.scan.status, window.vagalume.scan.onStatus)
export const useScanHistory = (): Live<readonly ScanRecord[]> => useLive(window.vagalume.scan.history, window.vagalume.scan.onHistory)
export const useSettings = (): Live<SettingsView> => useLive(window.vagalume.settings.get, null)
