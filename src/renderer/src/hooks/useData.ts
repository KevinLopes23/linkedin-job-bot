import { useEffect, useState } from 'react'
import type { Job, ScanRecord, ScanStatus, SettingsView } from '../../../shared/types'

/** Carga inicial + atualização por evento vindo do processo principal. */
function useLive<T>(load: () => Promise<T>, subscribe: ((listener: (value: T) => void) => () => void) | null): [T | null, (v: T) => void] {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let active = true
    let gotEvent = false
    const off = subscribe?.((value) => {
      gotEvent = true
      if (active) setData(value)
    })
    load().then(
      (value) => {
        // Se um evento chegou antes, ele é mais novo que a carga.
        if (active && !gotEvent) setData(value)
      },
      () => undefined
    )
    return () => {
      active = false
      off?.()
    }
  }, [])
  return [data, setData]
}

export const useJobs = () => useLive<readonly Job[]>(window.vagalume.jobs.list, window.vagalume.jobs.onChange)
export const useScanStatus = () => useLive<ScanStatus>(window.vagalume.scan.status, window.vagalume.scan.onStatus)[0]
export const useScanHistory = () => useLive<readonly ScanRecord[]>(window.vagalume.scan.history, window.vagalume.scan.onHistory)[0]
export const useSettings = () => useLive<SettingsView>(window.vagalume.settings.get, null)
