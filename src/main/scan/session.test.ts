import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LinkedInSession, type SessionContext, type SessionPage } from './session'

const dirs: string[] = []
const newDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'vagalume-session-'))
  dirs.push(d)
  return join(d, 'linkedin-profile')
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

/** Janela falsa: depois de `loginAfter` checagens o li_at aparece e a página vai para o feed. */
function fakeLauncher(opts: { loginAfter?: number; closeAfter?: number } = {}) {
  const calls = { launched: [] as boolean[], closed: 0, goto: [] as string[] }
  let checks = 0
  const page: SessionPage = {
    goto: async (url: string) => {
      calls.goto.push(url)
      return null
    },
    url: () => (opts.loginAfter !== undefined && checks > opts.loginAfter ? 'https://www.linkedin.com/feed/' : 'https://www.linkedin.com/login'),
    isClosed: () => opts.closeAfter !== undefined && checks > opts.closeAfter
  }
  const context: SessionContext = {
    pages: () => [page],
    newPage: async () => page,
    cookies: async () => {
      checks++
      return opts.loginAfter !== undefined && checks > opts.loginAfter ? [{ name: 'li_at' }] : [{ name: 'bcookie' }]
    },
    close: async () => {
      calls.closed++
    }
  }
  return {
    calls,
    launch: async (_dir: string, headless: boolean) => {
      calls.launched.push(headless)
      return context
    }
  }
}

const noSleep = async (): Promise<void> => undefined

describe('LinkedInSession', () => {
  it('começa desconectada e sem perfil ativo', () => {
    const s = new LinkedInSession(newDir(), fakeLauncher().launch, noSleep)
    expect(s.status()).toEqual({ connected: false, connectedAt: null, expired: false, connecting: false })
    expect(s.activeProfile()).toBeNull()
  })

  it('conecta quando o login termina: janela visível, grava o marcador e fecha a janela', async () => {
    const dir = newDir()
    const fake = fakeLauncher({ loginAfter: 2 })
    const s = new LinkedInSession(dir, fake.launch, noSleep)
    const view = await s.connect()
    expect(view).toMatchObject({ connected: true, expired: false, connecting: false })
    expect(view.connectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(fake.calls.launched).toEqual([false])
    expect(fake.calls.goto[0]).toBe('https://www.linkedin.com/login')
    expect(fake.calls.closed).toBe(1)
    expect(s.activeProfile()).toBe(dir)
    // Outra instância (app reaberto) lê o mesmo estado.
    expect(new LinkedInSession(dir, fake.launch, noSleep).status().connected).toBe(true)
  })

  it('janela fechada antes do login: erro claro e continua desconectada', async () => {
    const fake = fakeLauncher({ closeAfter: 1 })
    const s = new LinkedInSession(newDir(), fake.launch, noSleep)
    await expect(s.connect()).rejects.toThrow(/fechada antes/)
    expect(s.status()).toMatchObject({ connected: false, connecting: false })
    expect(fake.calls.closed).toBe(1)
  })

  it('tempo esgotado sem login', async () => {
    let now = 0
    const s = new LinkedInSession(newDir(), fakeLauncher().launch, async () => void (now += 60_000), () => now)
    await expect(s.connect()).rejects.toThrow(/Tempo esgotado/)
  })

  it('sessão expirada vira desconectada (varredura volta ao modo sem login) até conectar de novo', async () => {
    const dir = newDir()
    const s = new LinkedInSession(dir, fakeLauncher({ loginAfter: 0 }).launch, noSleep)
    await s.connect()
    s.markExpired()
    expect(s.status()).toMatchObject({ connected: false, expired: true })
    expect(s.activeProfile()).toBeNull()
    await s.connect()
    expect(s.status()).toMatchObject({ connected: true, expired: false })
  })

  it('desconectar apaga o perfil (cookies) do disco', async () => {
    const dir = newDir()
    const s = new LinkedInSession(dir, fakeLauncher({ loginAfter: 0 }).launch, noSleep)
    await s.connect()
    expect(existsSync(dir)).toBe(true)
    expect(s.disconnect()).toMatchObject({ connected: false, expired: false })
    expect(existsSync(dir)).toBe(false)
  })
})
