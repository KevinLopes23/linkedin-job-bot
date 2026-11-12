/**
 * Filtros do bot original (src/scraper.ts), agora como funções puras e configuráveis.
 * Os termos são fontes de regex (case-insensitive), uma por item.
 */
import type { SearchKind, WorkModel } from '../../shared/types'

/** O TÍTULO deve conter pelo menos um destes termos. */
export const DEFAULT_TITLE_TERMS: readonly string[] = [
  String.raw`\bdesenvolvedor`,
  String.raw`\bdeveloper\b`,
  String.raw`\banalista de sistemas\b`,
  String.raw`\bsystems analyst\b`,
  String.raw`\bprogramador`,
  String.raw`\bprogrammer\b`,
  String.raw`\bengenheir[oa] de software\b`,
  String.raw`\bsoftware engineer\b`,
  String.raw`\bfull[_\s-]?stack\b`,
  String.raw`\bfront[_\s-]?end\b`,
  String.raw`\bback[_\s-]?end\b`
]

/** Título ou texto do card que casar com qualquer um destes é descartado. */
export const DEFAULT_EXCLUDE_TERMS: readonly string[] = [
  // Senioridade
  String.raw`\bsenior\b`,
  String.raw`\bsênior\b`,
  String.raw`\bsr\b\.?`,
  String.raw`\blead\b`,
  String.raw`\blíder\b`,
  String.raw`\bprincipal\b`,
  String.raw`\bstaff\b`,
  String.raw`pleno\/sênior`,
  // Gestão / liderança
  String.raw`\bmanager\b`,
  String.raw`\bgerente\b`,
  String.raw`\bcoordenador`,
  String.raw`\bdiretor`,
  String.raw`\bdirector\b`,
  String.raw`\bhead\s+of\b`,
  String.raw`\bscrum\s+master\b`,
  String.raw`\bproduct\s+owner\b`,
  // Especialistas / arquitetos
  String.raw`\bspecialist\b`,
  String.raw`\bespecialista\b`,
  String.raw`\barchitect\b`,
  String.raw`\barquiteto\b`,
  // Plataformas / ferramentas específicas
  String.raw`\bsap\b`,
  String.raw`\bbobj\b`,
  String.raw`\bsalesforce\b`,
  String.raw`\bservicenow\b`,
  String.raw`\bsharepoint\b`,
  String.raw`\bdynamics\b`,
  String.raw`\bmainframe\b`,
  String.raw`\bcobol\b`,
  String.raw`\babap\b`,
  String.raw`\boutsystems\b`,
  String.raw`\bmulesoft\b`,
  String.raw`\bpeoplesoft\b`,
  String.raw`\btibco\b`,
  String.raw`\boracle\b`,
  String.raw`\bprotheus\b`,
  // Empresas bloqueadas
  String.raw`\bbairesdev\b`,
  // "Developer" que não é de software
  String.raw`\bproposal\b`,
  String.raw`\bbusiness\s+develop`,
  String.raw`\bcontent\s+develop`,
  String.raw`\btraining\b`,
  String.raw`\binstructional\b`,
  String.raw`\bcurriculum\b`,
  String.raw`\blearning\s+develop`,
  // QA / testes
  String.raw`\bautomation\s+test`,
  String.raw`\btest\s+develop`,
  String.raw`\btest\s+engineer`,
  String.raw`\btester\b`,
  String.raw`\bsdet\b`,
  String.raw`\bqa\b`,
  String.raw`\bquality\s+assurance`,
  // Dados / BI
  String.raw`\bdata\s+engineer`,
  String.raw`\bengenheir[oa]\s+de\s+dados`,
  String.raw`\bdba\b`,
  String.raw`\bpower\s*bi\b`,
  String.raw`\bbi\s+develop`,
  String.raw`\betl\b`,
  String.raw`\bdata\s+scientist`,
  String.raw`\bmachine\s+learning`,
  // Infra / DevOps / SRE
  String.raw`\bdevops\b`,
  String.raw`\binfrastructure\b`,
  String.raw`\bsysadmin\b`,
  String.raw`\bsre\b`,
  String.raw`\bsite\s+reliability`,
  String.raw`\bnetwork\s+engineer`,
  String.raw`\bsecurity\s+engineer`,
  String.raw`\bhardware\b`,
  String.raw`\bcloud\s+engineer`,
  String.raw`\bplatform\s+engineer`,
  // Tecnologias não desejadas
  String.raw`\bjava\b`,
  String.raw`\bphp\b`,
  String.raw`\blaravel\b`,
  String.raw`\bruby\b`,
  String.raw`\brails\b`,
  String.raw`\bgolang\b`,
  String.raw`\bgo\s+developer`,
  String.raw`\bc\+\+(?!\w)`,
  String.raw`\brust\b`,
  String.raw`\bdelphi\b`,
  // Mobile nativo
  String.raw`\bios\b`,
  String.raw`\bandroid\b`,
  String.raw`\bflutter\b`,
  String.raw`\bswift\b`,
  String.raw`\bkotlin\b`,
  // CMS / e-commerce
  String.raw`\bwordpress\b`,
  String.raw`\bmagento\b`,
  String.raw`\bvtex\b`,
  String.raw`\bshopify\b`,
  // Low-code / no-code
  String.raw`\bpower\s+platform\b`,
  String.raw`\bpower\s+apps\b`,
  String.raw`\blow[_\s-]?code\b`,
  String.raw`\bno[_\s-]?code\b`,
  // Níveis muito baixos
  String.raw`\best[áa]gio\b`,
  String.raw`\bintern\b`,
  String.raw`\binternship\b`,
  String.raw`\btrainee\b`
]

export const DEFAULT_KEYWORDS: readonly string[] = [
  'Desenvolvedor',
  'Programador',
  'Engenheiro de Software',
  'Software Engineer',
  'Developer',
  'Analista de Sistemas',
  'Fullstack',
  'Full Stack',
  'Backend',
  'Frontend',
  'Back-end',
  'Front-end'
]

export const DEFAULT_CITIES: readonly string[] = ['Bauru, São Paulo, Brasil']

/** geoId do Brasil no LinkedIn. */
const BRAZIL_GEO_ID = '106057199'

export function compileTerms(terms: readonly string[]): RegExp[] {
  return terms.map((t) => new RegExp(t, 'i'))
}

export const matchesAny = (patterns: readonly RegExp[], text: string): boolean => patterns.some((p) => p.test(text))

export interface SearchUrl {
  readonly url: string
  readonly kind: SearchKind
  /** Cidade da busca local (o card precisa citar o primeiro trecho dela). */
  readonly city: string | null
  readonly keyword: string
}

/**
 * URLs públicas de busca, como no bot: para cada palavra-chave, Brasil só remoto (f_WT=2) e cada cidade
 * presencial/híbrido (f_WT=1,3), níveis 2–4 (f_E=2,3,4) e janela de horas (f_TPR).
 */
export function buildSearchUrls(input: {
  keywords: readonly string[]
  searchRemote: boolean
  cities: readonly string[]
  hoursWindow: number
}): SearchUrl[] {
  const tpr = `r${Math.round(input.hoursWindow * 3600)}`
  const urls: SearchUrl[] = []
  for (const keyword of input.keywords) {
    const kw = encodeURIComponent(keyword)
    if (input.searchRemote) {
      urls.push({
        url: `https://www.linkedin.com/jobs/search/?f_TPR=${tpr}&f_WT=2&geoId=${BRAZIL_GEO_ID}&f_E=2%2C3%2C4&keywords=${kw}`,
        kind: 'remoto',
        city: null,
        keyword
      })
    }
    for (const city of input.cities) {
      urls.push({
        url: `https://www.linkedin.com/jobs/search/?f_TPR=${tpr}&f_WT=1%2C3&location=${encodeURIComponent(city)}&f_E=2%2C3%2C4&keywords=${kw}`,
        kind: 'local',
        city,
        keyword
      })
    }
  }
  return urls
}

/** Primeiro trecho do nome da cidade, em minúsculas ("Bauru, São Paulo, Brasil" → "bauru"). */
export const cityKey = (city: string): string => (city.split(',')[0] ?? '').trim().toLowerCase()

/** Modelo de trabalho pelo texto do card (sem palavra-chave = Indefinido, verificado depois na página). */
export function modelFromCard(text: string): WorkModel {
  const t = text.toLowerCase()
  if (t.includes('remoto') || t.includes('remote')) return 'Remoto'
  if (t.includes('híbrido') || t.includes('hybrid')) return 'Híbrido'
  if (t.includes('presencial') || t.includes('on-site') || t.includes('on site')) return 'Presencial'
  return 'Indefinido'
}

/** Modelo pelos badges do card (têm prioridade sobre o texto). */
export function modelFromBadges(badges: string): WorkModel | null {
  const t = badges.toLowerCase()
  if (t.includes('presencial') || t.includes('on-site') || t.includes('on site')) return 'Presencial'
  if (t.includes('híbrido') || t.includes('hybrid')) return 'Híbrido'
  if (t.includes('remoto') || t.includes('remote')) return 'Remoto'
  return null
}

/** Jeitos comuns de uma vaga dizer que é remota. */
const REMOTE_TEXT = /\bremot[oa]s?\b|\bremote\b|\bhome[ -]?office\b|\bteletrabalho\b|\bwork from home\b/

/**
 * Modelo pela página de detalhe. Prioridade Híbrido > Presencial > Remoto, como no bot
 * ("Híbrido com possibilidade de remoto" é Híbrido). Null se não der para afirmar.
 */
export function modelFromDetail(bodyText: string): WorkModel | null {
  const t = bodyText.toLowerCase()
  if (/\bhíbrido\b|\bhybrid\b/.test(t)) return 'Híbrido'
  if (/\bpresencial\b|\bon-site\b|\bon site\b/.test(t)) return 'Presencial'
  if (REMOTE_TEXT.test(t)) return 'Remoto'
  return null
}

const PROMOTED_CARD_MARKERS = ['promovida', 'promovido', 'promoted', 'actively recruiting', 'recrutando ativamente']
const PROMOTED_HTML_MARKERS = ['promoted', 'is-promoted', 'result-benefits', 'job-search-card__sponsored']

export function isPromotedCard(cardText: string, cardHtml: string): boolean {
  const text = cardText.toLowerCase()
  const html = cardHtml.toLowerCase()
  return PROMOTED_CARD_MARKERS.some((m) => text.includes(m)) || PROMOTED_HTML_MARKERS.some((m) => html.includes(m))
}

export function isPromotedDetail(bodyText: string, html: string): boolean {
  const t = bodyText.toLowerCase()
  const h = html.toLowerCase()
  return t.includes('promovida por quem') || t.includes('promoted by job') || h.includes('is-promoted') || h.includes('__sponsored')
}

/** Número de candidatos citado na página ("37 candidaturas", "mais de 200 candidaturas", "over 100 applicants"). */
export function parseApplicants(bodyText: string): number | null {
  const t = bodyText.toLowerCase()
  const exact = t.match(/(\d+)\s+(pessoas clicaram em|candidatura|applicant)/i)
  if (exact?.[1]) return parseInt(exact[1], 10)
  const over = t.match(/mais de (\d+)\s+(candidatura|applicant)/i) ?? t.match(/over (\d+)\s+applicant/i)
  if (over?.[1]) return parseInt(over[1], 10)
  return null
}

/** Mantém no máximo `max` vagas por empresa, somando as já guardadas nas últimas 24 h (anti-spam). */
export function limitPerCompany<T extends { company: string }>(
  jobs: readonly T[],
  recentByCompany: ReadonlyMap<string, number>,
  max: number
): { kept: T[]; dropped: T[] } {
  const counts = new Map<string, number>()
  const kept: T[] = []
  const dropped: T[] = []
  for (const job of jobs) {
    const key = companyKey(job.company)
    const count = counts.get(key) ?? recentByCompany.get(key) ?? 0
    if (count >= max) {
      dropped.push(job)
      continue
    }
    counts.set(key, count + 1)
    kept.push(job)
  }
  return { kept, dropped }
}

export const companyKey = (company: string): string => company.toLowerCase().trim()
