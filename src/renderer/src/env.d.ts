import type { VagalumeApi } from '../../shared/ipc'

declare global {
  interface Window {
    readonly vagalume: VagalumeApi
  }
}

export {}
