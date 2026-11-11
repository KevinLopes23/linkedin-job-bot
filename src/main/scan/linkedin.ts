/** Navegador da varredura: Chrome (ou Edge) do sistema, invisível, só páginas públicas do LinkedIn. */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'

const CHANNELS = ['chrome', 'msedge'] as const
const NAV_TIMEOUT_MS = 30_000
const CONTENT_TIMEOUT_MS = 10_000
const SEARCH_READY = '.jobs-search__results-list li, .base-search-card, .jobs-search-no-results-banner, .no-results'
const DETAIL_READY = '.show-more-less-html__markup, .description__text, .top-card-layout'

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

export class LinkedInBrowser {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null

  async open(): Promise<void> {
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
  async searchHtml(url: string): Promise<string> {
    const page = this.requirePage()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    assertSearchStatus(response?.status() ?? null)
    await page.waitForSelector(SEARCH_READY, { timeout: CONTENT_TIMEOUT_MS }).catch(() => undefined)
    // Rola para acionar o lazy-load e espera a rede assentar (sem pausa fixa).
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
    await page.evaluate(() => {
      document.querySelectorAll('li').forEach((li) => {
        const text = li.textContent ?? ''
        if (text.includes('Promoted') || text.includes('Promovida') || text.includes('Promovido')) li.remove()
      })
    })
    return page.content()
  }

  async detailHtml(url: string): Promise<string> {
    const page = this.requirePage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await page.waitForSelector(DETAIL_READY, { timeout: CONTENT_TIMEOUT_MS }).catch(() => undefined)
    return page.content()
  }

  async close(): Promise<void> {
    const browser = this.browser
    this.browser = null
    this.context = null
    this.page = null
    if (browser) await browser.close().catch(() => undefined)
  }

  private requirePage(): Page {
    if (!this.page) throw new Error('Navegador não iniciado.')
    return this.page
  }
}
