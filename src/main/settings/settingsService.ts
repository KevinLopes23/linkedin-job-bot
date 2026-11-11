import { safeStorage } from 'electron'
import type { Settings, SettingsView } from '../../shared/types'
import { parseSettings } from '../data/validation'
import type { JsonFile } from '../store/jsonFile'

export interface Secrets {
  /** Chave do Gemini criptografada pelo Windows (DPAPI) via safeStorage, em base64. */
  readonly geminiKey?: string
}

const GEMINI_KEY_PATTERN = /^[A-Za-z0-9_.-]{20,200}$/

export function parseSecrets(raw: unknown): Secrets {
  if (typeof raw !== 'object' || raw === null) return {}
  const key = (raw as Secrets).geminiKey
  return typeof key === 'string' ? { geminiKey: key } : {}
}

export class SettingsService {
  /** A falha de decifrar a chave vai para o log uma vez só (view/varredura chamam isso o tempo todo). */
  private unreadableLogged = false

  constructor(
    private readonly file: JsonFile<Settings>,
    private readonly secrets: JsonFile<Secrets>,
    private readonly onChange: (settings: Settings) => void
  ) {}

  get(): Settings {
    return this.file.read()
  }

  view(): SettingsView {
    const key = this.getGeminiKey()
    return { ...this.get(), hasGeminiKey: key !== null, geminiKeyUnreadable: key === null && Boolean(this.secrets.read().geminiKey) }
  }

  save(raw: unknown): SettingsView {
    const settings = parseSettings(raw)
    this.file.write(settings)
    this.onChange(settings)
    return this.view()
  }

  setGeminiKey(raw: unknown): SettingsView {
    const key = typeof raw === 'string' ? raw.trim() : ''
    if (!GEMINI_KEY_PATTERN.test(key)) throw new Error('Chave do Gemini inválida. Copie a chave inteira do Google AI Studio.')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('A criptografia do Windows não está disponível; a chave não foi salva.')
    }
    this.secrets.write({ geminiKey: safeStorage.encryptString(key).toString('base64') })
    this.unreadableLogged = false
    return this.view()
  }

  clearGeminiKey(): SettingsView {
    this.secrets.write({})
    this.unreadableLogged = false
    return this.view()
  }

  getGeminiKey(): string | null {
    const stored = this.secrets.read().geminiKey
    if (!stored) return null
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'))
    } catch (error) {
      if (!this.unreadableLogged) {
        this.unreadableLogged = true
        console.error('[settings] A chave do Gemini está salva mas não pôde ser decifrada:', error instanceof Error ? error.message : error)
      }
      return null
    }
  }
}
