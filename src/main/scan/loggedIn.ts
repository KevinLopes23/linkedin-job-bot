/**
 * Páginas do LinkedIn com login. A busca logada é um app React com classes ofuscadas, então o navegador
 * entrega só o texto visível (innerText) de cada card e da vaga; aqui esse texto vira o mesmo HTML que a
 * busca pública usa, e o resto da varredura (filtros, conferência) segue igual. Funções puras.
 */

/** Card da lista logada como o navegador lê: componentkey="job-card-component-ref-<id>" + linhas de texto. */
export interface LoggedCard {
  readonly key: string
  readonly lines: readonly string[]
}

export interface LoggedCardInfo {
  readonly id: string
  readonly title: string
  readonly company: string
  readonly location: string
  readonly text: string
}

export interface LoggedDetailParts {
  /** Cabeçalho da vaga: local, tempo, candidatos, promovida, selo de modelo (Remoto/Híbrido/Presencial). */
  readonly top: string
  readonly description: string
}

export const LOGGED_CARD_SELECTOR = '[componentkey^="job-card-component-ref-"]'
const CARD_KEY = /^job-card-component-ref-(\d{6,})$/
// Rótulos em português e em inglês: logado, o LinkedIn usa o idioma da conta (não o do navegador).
const DESCRIPTION_STARTS = ['Sobre a vaga', 'About the job']
const TOP_END = new Set(['Candidatar-se', 'Candidatura simplificada', 'Salvar', 'Apply', 'Easy Apply', 'Save', ...DESCRIPTION_STARTS])
// Só módulos da página (nunca títulos comuns dentro da descrição, como "Benefícios").
const DESCRIPTION_END = /^(Sobre a empresa|Vagas semelhantes|Pessoas também|Mais vagas|About the company|Similar jobs|People also viewed|More jobs)\b/
const NO_RESULTS = /nenhuma vaga (corresponde|encontrada)|não encontramos|no matching jobs|no jobs found|we couldn.t find/i
const JOB_VIEW_HOST = /^([a-z]{2,3}\.|www\.)?linkedin\.com$/
const SHOW_MORE = /^(…|\.\.\.)\s*(mais|ver mais|exibir mais)$/i
const MAX_TOP_LINES = 15

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Primeira linha do card é o rótulo de acessibilidade: "Selecionada, <título> (vaga verificada)". */
const cleanTitle = (line: string): string =>
  squash(line)
    .replace(/^(selecionada|selected),\s*/i, '')
    .replace(/\s*\((vaga verificada|verified job)\)\s*$/i, '')

export function parseLoggedCard(card: LoggedCard): LoggedCardInfo | null {
  const id = card.key.match(CARD_KEY)?.[1]
  const lines = card.lines.map(squash).filter(Boolean)
  if (!id || lines.length < 3) return null
  const title = cleanTitle(lines[0] ?? '')
  // O título às vezes vem repetido na 2ª linha (rótulo + título visível).
  const start = squash(lines[1] ?? '') === title ? 2 : 1
  const company = lines[start]
  const location = lines[start + 1]
  if (!title || !company || !location) return null
  return { id, title, company, location, text: lines.join(' · ') }
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const cardHtml = (c: LoggedCardInfo): string =>
  `<li class="base-search-card" data-entity-urn="urn:li:jobPosting:${c.id}">` +
  `<a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${c.id}/"></a>` +
  ` <h3 class="base-search-card__title">${escapeHtml(c.title)}</h3> ` +
  `<h4 class="base-search-card__subtitle">${escapeHtml(c.company)}</h4> ` +
  `<span class="job-search-card__location">${escapeHtml(c.location)}</span> ` +
  `<p>${escapeHtml(c.text)}</p></li>`

/** Lista logada no formato da busca pública (a lista existe mesmo vazia: "sem vagas" não é bloqueio). */
export function loggedCardsToHtml(cards: readonly LoggedCard[]): string {
  const unique = new Map<string, LoggedCardInfo>()
  for (const card of cards) {
    const info = parseLoggedCard(card)
    if (info && !unique.has(info.id)) unique.set(info.id, info)
  }
  return `<html><body><ul class="jobs-search__results-list">${[...unique.values()].map(cardHtml).join('')}</ul></body></html>`
}

/** Separa o texto da vaga logada em cabeçalho e descrição ("Sobre a vaga" até "Sobre a empresa"). */
export function splitLoggedDetail(text: string): LoggedDetailParts {
  const lines = text.split('\n').map(squash).filter(Boolean)
  const topEnd = lines.findIndex((l) => TOP_END.has(l))
  const top = lines.slice(0, topEnd === -1 ? MAX_TOP_LINES : Math.min(topEnd, MAX_TOP_LINES))
  const start = lines.findIndex((l) => DESCRIPTION_STARTS.includes(l))
  if (start === -1) return { top: top.join('\n'), description: '' }
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => DESCRIPTION_END.test(l))
  const description = (end === -1 ? rest : rest.slice(0, end)).filter((l) => !SHOW_MORE.test(l))
  return { top: top.join('\n'), description: description.join('\n') }
}

const paragraphs = (text: string): string =>
  text
    .split('\n')
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    // Quebra entre parágrafos: sem ela o texto vira "LinkedInHíbridoTempo" e \b não acha a palavra.
    .join('\n')

/**
 * Vaga logada no formato da página pública. A descrição fica FORA da área lida para o modelo de trabalho:
 * logado o selo do topo é confiável, e "encontros presenciais" na descrição não pode derrubar vaga remota.
 */
export function loggedDetailToHtml(parts: LoggedDetailParts): string {
  return (
    `<html><body><section class="top-card-layout">${paragraphs(parts.top)}</section>` +
    `<div class="logged-description"><div class="show-more-less-html__markup">${paragraphs(parts.description)}</div></div></body></html>`
  )
}

/** A página da vaga logada carregou a seção da vaga ("Sobre a vaga" / "About the job"). */
export const hasJobSection = (text: string): boolean => text.split('\n').some((l) => DESCRIPTION_STARTS.includes(squash(l)))

/** Lista logada vazia porque o LinkedIn disse que não há vagas (e não porque a página não carregou). */
export const isLoggedNoResults = (text: string): boolean => NO_RESULTS.test(text)

/** Só links https de vaga do LinkedIn são abertos com a sessão do usuário. */
export function isJobViewUrl(url: string): boolean {
  if (!URL.canParse(url)) return false
  const parsed = new URL(url)
  return parsed.protocol === 'https:' && JOB_VIEW_HOST.test(parsed.hostname) && parsed.pathname.startsWith('/jobs/view/')
}

/** O LinkedIn mandou para login/verificação: a sessão salva expirou ou foi barrada. */
export function isLoggedOutUrl(url: string): boolean {
  if (!URL.canParse(url)) return false
  return /^\/(login|authwall|checkpoint|uas\/login|signup)\b/.test(new URL(url).pathname)
}
