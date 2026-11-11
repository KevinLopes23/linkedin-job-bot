/** Leitura do HTML público do LinkedIn (lista de busca e página da vaga). Funções puras. */
import * as cheerio from 'cheerio'
import type { SearchKind, WorkModel } from '../../shared/types'
import {
  cityKey,
  isPromotedCard,
  isPromotedDetail,
  matchesAny,
  modelFromBadges,
  modelFromCard,
  modelFromDetail,
  parseApplicants,
  type SearchUrl
} from './filters'

const MAX_DESCRIPTION_CHARS = 8_000
const MAX_CARD_TEXT = 500

export interface Candidate {
  readonly id: string
  readonly title: string
  readonly company: string
  readonly location: string
  readonly model: WorkModel
  readonly link: string
  readonly searchKind: SearchKind
}

export interface SearchPageResult {
  readonly cards: number
  readonly candidates: Candidate[]
}

export interface Patterns {
  readonly title: readonly RegExp[]
  readonly exclude: readonly RegExp[]
}

/** ID da vaga: data-entity-urn, depois /jobs/view/<id>, depois "-<id>" no fim do slug, depois 9–11 dígitos. */
export function extractJobId(urn: string | undefined, link: string): string {
  const fromUrn = urn?.match(/urn:li:jobPosting:(\d+)/)?.[1]
  if (fromUrn) return fromUrn
  if (!link) return ''
  const fromLink = link.match(/\/jobs\/view\/(?:jobPosting\/)?(\d+)/) ?? link.match(/-(\d+)\/?(?:\?|$)/)
  if (fromLink?.[1]) return fromLink[1]
  return link.match(/\d{9,11}/)?.[0] ?? ''
}

export function parseSearchHtml(html: string, search: Pick<SearchUrl, 'kind' | 'city'>, patterns: Patterns): SearchPageResult {
  const $ = cheerio.load(html)
  const cards = $('.jobs-search__results-list li, .base-search-card, .job-search-card')
  const candidates: Candidate[] = []

  cards.each((_, element) => {
    const card = $(element)
    // Só o começo do card entra nas regex do usuário (limita o custo de uma regex mal escrita).
    const cardText = card.text().replace(/\s+/g, ' ').slice(0, MAX_CARD_TEXT)
    if (isPromotedCard(cardText, card.html() ?? '')) return

    const title = card.find('.base-search-card__title, .job-search-card__title, h3, h4').first().text().trim()
    if (!title || !matchesAny(patterns.title, title)) return
    if (matchesAny(patterns.exclude, title) || matchesAny(patterns.exclude, cardText)) return

    const company =
      card.find('.base-search-card__subtitle, .job-search-card__subtitle, .base-search-card__subtitle-link').first().text().trim() ||
      'Empresa confidencial'
    const location = card.find('.job-search-card__location, .base-search-card__metadata span').first().text().trim()

    if (search.kind === 'local' && search.city && !location.toLowerCase().includes(cityKey(search.city))) return

    const badges = card.find('.job-search-card__metadata span, .result-benefits__text, .job-search-card__location').text()
    const model = modelFromBadges(badges) ?? modelFromCard(cardText)
    // Busca remota: descarta o que o LinkedIn marcou como híbrido/presencial.
    if (search.kind === 'remoto' && (model === 'Presencial' || model === 'Híbrido')) return

    const linkEl = card.find('a.base-card__full-link, a.base-search-card__title-link, a').first()
    const link = linkEl.attr('href') ?? ''
    const id = extractJobId(card.attr('data-entity-urn') ?? linkEl.attr('data-entity-urn'), link)
    if (!id || !link) return

    candidates.push({
      id,
      title,
      company,
      location: location || (search.kind === 'local' ? (search.city ?? '') : 'Brasil'),
      model,
      link: link.split('?')[0] ?? link,
      searchKind: search.kind
    })
  })

  return { cards: cards.length, candidates }
}

/** Junta as vagas repetidas entre buscas (a última leitura vence, como no bot). */
export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((i) => [i.id, i])).values()]
}

export type DetailVerdict =
  | { readonly ok: true; readonly model: WorkModel; readonly applicants: number | null; readonly description: string }
  | { readonly ok: false; readonly reason: string }

/** Só a área da própria vaga: cabeçalho, descrição e critérios (fora "Vagas semelhantes" e afins). */
const JOB_SCOPE = '.top-card-layout, .decorated-job-posting__details'

function descriptionText($: cheerio.CheerioAPI): string {
  const markup = $('.show-more-less-html__markup').first()
  const node = markup.length > 0 ? markup : $('.description__text').first()
  node.find('br, p, li').after('\n')
  return node
    .text()
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n\s*/g, '\n')
    .trim()
    .slice(0, MAX_DESCRIPTION_CHARS)
}

/**
 * Confere a página da vaga: modelo real, promovida, limite de candidatos. Também extrai a descrição.
 * Lê só a área da vaga: o resto da página lista outras vagas ("... - Híbrido") e enganava a detecção.
 */
export function checkDetail(html: string, candidate: Candidate, maxApplicants: number): DetailVerdict {
  const $ = cheerio.load(html)
  const scope = $(JOB_SCOPE)
  // Sem a área da vaga (LinkedIn pediu login): não aprova nem grava; a vaga volta na próxima varredura.
  if (scope.length === 0) return { ok: false, reason: 'não abriu (o LinkedIn pediu login); fica para a próxima varredura' }
  const jobText = scope.text()
  const jobHtml = $.html(scope)
  let model = modelFromDetail(jobText) ?? candidate.model

  if (candidate.searchKind === 'remoto' && (model === 'Presencial' || model === 'Híbrido')) {
    return { ok: false, reason: `é ${model} na página da vaga (busca remota)` }
  }
  if (isPromotedDetail(jobText, jobHtml)) return { ok: false, reason: 'é promovida' }
  // Sem modelo escrito na vaga: na busca remota vale o filtro dela (f_WT=2). A página pública raramente diz
  // "Remoto" na área da vaga; o bot só aprovava porque lia "vagas semelhantes". Na busca por cidade (f_WT=1,3)
  // pode ser presencial ou híbrido, então fica Indefinido (a tela mostra "Presencial ou híbrido").
  if (model === 'Indefinido' && candidate.searchKind === 'remoto') model = 'Remoto'
  const applicants = parseApplicants(jobText)
  if (maxApplicants > 0 && applicants !== null && applicants > maxApplicants) {
    return { ok: false, reason: `tem ${applicants} candidatos (limite ${maxApplicants})` }
  }
  return { ok: true, model, applicants, description: descriptionText($) }
}
