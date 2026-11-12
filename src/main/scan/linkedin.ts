/**
 * Navegador da varredura: Chrome (ou Edge) do sistema, invisível. Sem sessão lê as páginas públicas do
 * LinkedIn; com sessão (perfil do Vagalume) lê as páginas logadas e as converte para o mesmo formato.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'
import {
  hasJobSection,
  isJobViewUrl,
  isLoggedNoResults,
  isLoggedOutUrl,
  LOGGED_CARD_SELECTOR,
  loggedCardsToHtml,
  loggedDetailToHtml,
  splitLoggedDetail
} from './loggedIn'
import { PROMOTED_ITEM_MARKERS } from './parse'

const CHANNELS = ['chrome', 'msedge'] as const
const NAV_TIMEOUT_MS = 30_000
const CONTENT_TIMEOUT_MS = 10_000
const SEARCH_READY = '.jobs-search__results-list li, .base-search-card, .jobs-search-no-results-banner, .no-results'
const DETAIL_READY = '.show-more-less-html__markup, .description__text, .top-card-layout'
/** A lista logada mostra ~7 cards por vez; rolar carrega o resto da página (25). */
const LOGGED_SCROLL_STEPS = 10
/** Ponto sobre a lista de vagas (coluna da esquerda) para a rolagem do mouse. */
const LIST_POINT = { x: 300, y: 500 }

/** Resposta HTTP de erro do LinkedIn (429 = muitas buscas seguidas) vira falha da busca, não "sem vagas". */
export function assertSearchStatus(status: number | null): void {
  if (status === null || status < 400) return
  const hint = status === 429 ? ' (muitas buscas seguidas; aumente a pausa entre buscas)' : ''
  throw new Error(`o LinkedIn respondeu HTTP ${status}${hint}`)
}

export function browserErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/executable doesn't exist|is not found|not found at/i.test(raw)) {
    return 'Nem Google Chrome nem Microsoft Edge foram encontrados. Instale um deles para varrer o LinkedIn.'
  }
  return `Falha no navegador: ${raw.slice(0, 200)}`
}

/** Sem a flag de automação (o LinkedIn e o Google desconfiam dela) e sem navigator.webdriver. */
const STEALTH = { ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] }

/** Chrome com o perfil do Vagalume (sessão do LinkedIn). Visível só na janela de login. */
export async function launchProfile(profileDir: string, headless: boolean): Promise<BrowserContext> {
  let lastError: unknown = null
  for (const channel of CHANNELS) {
    try {
      return await chromium.launchPersistentContext(profileDir, {
        channel,
        headless,
        ...STEALTH,
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        ...(headless ? { viewport: { width: 1280, height: 900 } } : { viewport: null })
      })
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(browserErrorMessage(lastError))
}

/**
 * Busca por cidade (location=, sem geoId). Logado, a busca nova do LinkedIn (com IA) ignora a cidade escrita e
 * devolve o Brasil todo; a página pública acerta a cidade. Então a lista da cidade vem sempre da pública.
 */
export function isCitySearch(url: string): boolean {
  if (!URL.canParse(url)) return false
  const params = new URL(url).searchParams
  return params.has('location') && !params.has('geoId')
}

const PUBLIC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
}

/** Página pública sem cookies (a sessão do usuário não vai junto). */
async function fetchPublicHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: PUBLIC_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(NAV_TIMEOUT_MS) })
  assertSearchStatus(response.status)
  return response.text()
}

export const SESSION_EXPIRED = 'a sessão do LinkedIn expirou; conecte de novo em Configurações (seguindo sem login)'

export interface BrowserOptions {
  /** Perfil com sessão do LinkedIn; null = páginas públicas, sem login. */
  readonly profileDir?: string | null
  /** Chamado quando o LinkedIn manda para o login no meio da varredura. */
  readonly onLoggedOut?: () => void
}

export class LinkedInBrowser {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private loggedIn = false
  private openWarning: string | null = null

  constructor(private readonly options: BrowserOptions = {}) {}

  async open(): Promise<void> {
    if (this.options.profileDir) {
      try {
        this.context = await launchProfile(this.options.profileDir, true)
        this.page = this.context.pages()[0] ?? (await this.context.newPage())
        this.loggedIn = true
        return
      } catch (error) {
        // Perfil travado (Chrome antigo ainda aberto, antivírus): segue sem login em vez de perder a varredura.
        await this.close()
        this.openWarning = `Não deu para abrir a sessão do LinkedIn (${error instanceof Error ? error.message : String(error)}); seguindo sem login.`
      }
    }
    await this.openPublic()
  }

  /** Aviso da abertura (ex.: sessão não abriu e caiu para o modo sem login). */
  get warning(): string | null {
    return this.openWarning
  }

  /** Chrome anônimo (sem perfil), só páginas públicas. */
  private async openPublic(): Promise<void> {
    let lastError: unknown = null
    for (const channel of CHANNELS) {
      try {
        this.browser = await chromium.launch({
          channel,
          headless: true,
          args: ['--disable-blink-features=AutomationControlled']
        })
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!this.browser) throw new Error(browserErrorMessage(lastError))
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
    })
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    this.page = await this.context.newPage()
  }

  /** HTML da página de busca, sem os itens promovidos (equivalente ao filtro uBlock do bot). */
  get isLoggedIn(): boolean {
    return this.loggedIn
  }

  async searchHtml(url: string): Promise<string> {
    if (this.loggedIn) return this.loggedSearchHtml(url)
    const page = this.requirePage()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    assertSearchStatus(response?.status() ?? null)
    await page.waitForSelector(SEARCH_READY, { timeout: CONTENT_TIMEOUT_MS }).catch(() => undefined)
    // Rola para acionar o lazy-load e espera a rede assentar (sem pausa fixa).
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
    await page.evaluate((markers) => {
      document.querySelectorAll('li').forEach((li) => {
        const text = li.textContent ?? ''
        if (markers.some((m) => text.includes(m))) li.remove()
      })
    }, [...PROMOTED_ITEM_MARKERS])
    return page.content()
  }

  async detailHtml(url: string): Promise<string> {
    if (this.loggedIn) return this.loggedDetailHtml(url)
    const page = this.requirePage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await page.waitForSelector(DETAIL_READY, { timeout: CONTENT_TIMEOUT_MS }).catch(() => undefined)
    return page.content()
  }

  async close(): Promise<void> {
    const browser = this.browser
    const context = this.context
    this.browser = null
    this.context = null
    this.page = null
    if (browser) await browser.close().catch(() => undefined)
    else if (context) await context.close().catch(() => undefined)
  }

  /** Busca logada: a lista é carregada aos poucos ao rolar; o texto de cada card vira o HTML da busca pública. */
  private async loggedSearchHtml(url: string): Promise<string> {
    if (isCitySearch(url)) return fetchPublicHtml(url)
    const page = this.requirePage()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    assertSearchStatus(response?.status() ?? null)
    await this.ensureSession(page)
    const hasCards = await page
      .waitForSelector(LOGGED_CARD_SELECTOR, { timeout: CONTENT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false)
    await this.ensureSession(page)
    if (!hasCards) {
      // Lista vazia só conta como "sem vagas" se o LinkedIn disser isso; senão a página não carregou
      // (verificação de segurança, restrição da conta, rede) e a busca tem que falhar, não sumir.
      const text = await page.evaluate(() => document.body.innerText)
      if (isLoggedNoResults(text)) return loggedCardsToHtml([])
      throw new Error('a lista de vagas com login não carregou (o LinkedIn pode ter pedido verificação)')
    }
    for (let i = 0; i < LOGGED_SCROLL_STEPS; i++) {
      await page.mouse.move(LIST_POINT.x, LIST_POINT.y)
      await page.mouse.wheel(0, 900)
      await page.waitForTimeout(600)
    }
    const cards = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((el) => ({
          key: el.getAttribute('componentkey') ?? '',
          lines: el.innerText.split('\n')
        })),
      LOGGED_CARD_SELECTOR
    )
    return loggedCardsToHtml(cards)
  }

  private async loggedDetailHtml(url: string): Promise<string> {
    // Com a sessão do usuário só se abre página de vaga do LinkedIn (o link da cidade vem da página pública).
    if (!isJobViewUrl(url)) throw new Error('link de vaga inesperado')
    const page = this.requirePage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await this.ensureSession(page)
    await page.getByText(/^(Sobre a vaga|About the job)$/).first().waitFor({ timeout: CONTENT_TIMEOUT_MS }).catch(() => undefined)
    await this.ensureSession(page)
    const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
    // Sem a seção da vaga não dá para conferir nada: falha (a vaga é ignorada) em vez de aprovar no escuro.
    if (!hasJobSection(text)) throw new Error('a página da vaga não carregou')
    return loggedDetailToHtml(splitLoggedDetail(text))
  }

  /** LinkedIn mandou para o login: avisa, troca para o modo sem login e falha só esta página. */
  private async ensureSession(page: Page): Promise<void> {
    if (!isLoggedOutUrl(page.url())) return
    this.options.onLoggedOut?.()
    await this.close()
    this.loggedIn = false
    await this.openPublic()
    throw new Error(SESSION_EXPIRED)
  }

  private requirePage(): Page {
    if (!this.page) throw new Error('Navegador não iniciado.')
    return this.page
  }
}
