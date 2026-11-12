/**
 * Sessão opcional do LinkedIn. O usuário entra numa janela do Chrome (a senha vai direto para o site,
 * o app nunca vê); os cookies ficam num perfil só do Vagalume, separado do Chrome dele. Com sessão ativa
 * a varredura usa esse perfil, e o LinkedIn passa a respeitar o filtro de modelo (remoto/híbrido/presencial).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LinkedInSessionView } from '../../shared/types'
import { isLoggedOutUrl } from './loggedIn'

export interface SessionPage {
  goto(url: string): Promise<unknown>
  url(): string
  isClosed(): boolean
}

export interface SessionContext {
  pages(): SessionPage[]
  newPage(): Promise<SessionPage>
  cookies(url: string): Promise<ReadonlyArray<{ name: string }>>
  close(): Promise<void>
}

export type SessionLauncher = (profileDir: string, headless: boolean) => Promise<SessionContext>

const LOGIN_URL = 'https://www.linkedin.com/login'
const MARKER = 'vagalume-session.json'
const POLL_MS = 2_000
/** Tempo para o Chrome gravar os cookies no disco depois do login. */
const SETTLE_MS = 3_000
const LOGIN_TIMEOUT_MS = 15 * 60_000

interface Marker {
  readonly connectedAt: string
  readonly expired: boolean
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class LinkedInSession {
  private connecting = false

  constructor(
    readonly profileDir: string,
    private readonly launch: SessionLauncher,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
    private readonly now: () => number = Date.now
  ) {}

  status(): LinkedInSessionView {
    const marker = this.readMarker()
    return {
      connected: marker !== null && !marker.expired,
      connectedAt: marker?.connectedAt ?? null,
      expired: marker?.expired ?? false,
      connecting: this.connecting
    }
  }

  /** Perfil para a varredura usar, ou null (sem sessão, expirada, ou janela de login aberta usando o perfil). */
  activeProfile(): string | null {
    return this.status().connected && !this.connecting ? this.profileDir : null
  }

  /** Abre a janela de login e espera o usuário entrar (ou fechar a janela). */
  async connect(): Promise<LinkedInSessionView> {
    if (this.connecting) throw new Error('A janela de login do LinkedIn já está aberta.')
    this.connecting = true
    let context: SessionContext | null = null
    try {
      mkdirSync(this.profileDir, { recursive: true })
      context = await this.launch(this.profileDir, false)
      const page = context.pages()[0] ?? (await context.newPage())
      await page.goto(LOGIN_URL)
      await this.waitForLogin(context, page)
      await this.sleep(SETTLE_MS)
      this.writeMarker({ connectedAt: new Date(this.now()).toISOString(), expired: false })
    } finally {
      this.connecting = false
      await context?.close().catch(() => undefined)
    }
    return this.status()
  }

  /** O LinkedIn pediu login durante a varredura: a sessão salva não vale mais. */
  markExpired(): void {
    const marker = this.readMarker()
    if (marker && !marker.expired) this.writeMarker({ ...marker, expired: true })
  }

  /** Apaga o perfil inteiro (cookies incluídos). */
  disconnect(): LinkedInSessionView {
    if (this.connecting) throw new Error('Feche a janela de login do LinkedIn antes de desconectar.')
    try {
      // O Chrome pode estar terminando de fechar e segurar arquivos do perfil por um instante.
      rmSync(this.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
    } catch {
      throw new Error('Não deu para apagar a sessão agora (o Chrome ainda está fechando). Tente de novo em alguns segundos.')
    }
    return this.status()
  }

  private async waitForLogin(context: SessionContext, page: SessionPage): Promise<void> {
    const deadline = this.now() + LOGIN_TIMEOUT_MS
    for (;;) {
      if (page.isClosed()) throw new Error('A janela foi fechada antes de terminar o login.')
      const cookies = await context.cookies('https://www.linkedin.com').catch(() => null)
      if (cookies === null) throw new Error('A janela foi fechada antes de terminar o login.')
      // O login pode terminar em outra aba (Google, verificação): basta uma página fora das telas de login.
      const pages = context.pages().filter((p) => !p.isClosed())
      if (cookies.some((c) => c.name === 'li_at') && pages.some((p) => !isLoggedOutUrl(p.url()))) return
      if (this.now() > deadline) throw new Error('Tempo esgotado esperando o login do LinkedIn. Tente de novo.')
      await this.sleep(POLL_MS)
    }
  }

  private readMarker(): Marker | null {
    try {
      const raw = JSON.parse(readFileSync(join(this.profileDir, MARKER), 'utf8')) as Partial<Marker>
      if (typeof raw.connectedAt !== 'string') return null
      return { connectedAt: raw.connectedAt, expired: raw.expired === true }
    } catch {
      return null
    }
  }

  private writeMarker(marker: Marker): void {
    if (!existsSync(this.profileDir)) return
    writeFileSync(join(this.profileDir, MARKER), JSON.stringify(marker))
  }
}
