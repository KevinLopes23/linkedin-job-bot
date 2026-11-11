import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '../../shared/types'
import { DEFAULT_SETTINGS, parseStoredSettings } from '../data/validation'
import { JsonFile } from '../store/jsonFile'
import { parseSecrets, SettingsService, type Secrets } from './settingsService'

// safeStorage de mentira: "cifra" com prefixo; texto sem o prefixo simula a chave que o Windows não abre mais.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (text: string) => Buffer.from(`ok:${text}`),
    decryptString: (buffer: Buffer) => {
      const text = buffer.toString()
      if (!text.startsWith('ok:')) throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.')
      return text.slice(3)
    }
  }
}))

let dir = ''
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function service() {
  dir = mkdtempSync(join(tmpdir(), 'vagalume-settings-'))
  const secrets = new JsonFile<Secrets>(join(dir, 'secrets.json'), parseSecrets, () => ({}))
  const settings = new SettingsService(
    new JsonFile<Settings>(join(dir, 'settings.json'), parseStoredSettings, () => DEFAULT_SETTINGS),
    secrets,
    () => undefined
  )
  return { settings, secrets }
}

describe('SettingsService · chave do Gemini', () => {
  it('sem chave: nem salva nem ilegível', () => {
    expect(service().settings.view()).toMatchObject({ hasGeminiKey: false, geminiKeyUnreadable: false })
  })

  it('chave salva abre normalmente', () => {
    const { settings } = service()
    settings.setGeminiKey('AIzaSyFakeKeyForTests_1234567890')
    expect(settings.view()).toMatchObject({ hasGeminiKey: true, geminiKeyUnreadable: false })
    expect(settings.getGeminiKey()).toBe('AIzaSyFakeKeyForTests_1234567890')
  })

  it('chave salva que o Windows não decifra aparece como ilegível (e é registrada no log)', () => {
    const { settings, secrets } = service()
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    secrets.write({ geminiKey: Buffer.from('cifrada-em-outro-perfil').toString('base64') })
    expect(settings.view()).toMatchObject({ hasGeminiKey: false, geminiKeyUnreadable: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('loga a chave ilegível uma vez só, e de novo depois que uma chave nova é salva (N4)', () => {
    const { settings, secrets } = service()
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = { geminiKey: Buffer.from('cifrada-em-outro-perfil').toString('base64') }
    secrets.write(broken)
    for (let i = 0; i < 5; i++) settings.view()
    settings.getGeminiKey()
    expect(log).toHaveBeenCalledTimes(1)
    settings.setGeminiKey('AIzaSyFakeKeyForTests_1234567890')
    secrets.write(broken)
    settings.view()
    settings.view()
    expect(log).toHaveBeenCalledTimes(2)
  })
})
