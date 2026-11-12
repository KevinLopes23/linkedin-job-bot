import type { JobStatus, LinkedInSessionView, WorkModel } from '../../../shared/types'

export const STATUS_LABEL: Record<JobStatus, string> = {
  nova: 'Nova',
  salva: 'Salva',
  aplicada: 'Aplicada',
  entrevista: 'Entrevista',
  descartada: 'Descartada'
}

/** Indefinido só sobra na busca por cidade, que pega presencial e híbrido. */
export const modelLabel = (model: WorkModel): string => (model === 'Indefinido' ? 'Presencial ou híbrido' : model)

/** Filtro por modelo: vaga sem modelo escrito (busca por cidade) entra em Presencial e em Híbrido. */
export const matchesModel = (model: WorkModel, filter: WorkModel): boolean =>
  model === filter || (model === 'Indefinido' && (filter === 'Presencial' || filter === 'Híbrido'))

/** Situação do login opcional do LinkedIn, para a tela de Configurações. */
export function sessionLabel(view: LinkedInSessionView | null): string {
  if (!view) return 'Verificando…'
  if (view.connecting) return 'Janela de login aberta: entre na sua conta do LinkedIn por lá.'
  if (view.connected && view.connectedAt) {
    return `Conectado em ${new Date(view.connectedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
  }
  if (view.expired) return 'A sessão expirou: conecte de novo. Até lá a varredura segue sem login.'
  return 'Não conectado: a varredura usa as páginas públicas (sem filtro de modelo do LinkedIn).'
}

/** Mensagem limpa de um erro vindo do IPC (sem o prefixo técnico do Electron). */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso))
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}

/** "em 12 min", "em 1 h 05". */
export function timeUntil(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000))
  if (min < 1) return 'em instantes'
  if (min < 60) return `em ${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `em ${h} h` : `em ${h} h ${String(rest).padStart(2, '0')}`
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export type Tone = 'alto' | 'medio' | 'baixo' | 'sem'

export function scoreTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return 'sem'
  if (score >= 75) return 'alto'
  if (score >= 50) return 'medio'
  return 'baixo'
}

/** Intensidade do brilho (0–1): só vagas com nota acendem, e cresce rápido acima de 50. */
export function glow(score: number | null | undefined): number {
  if (score === null || score === undefined) return 0
  const t = Math.min(1, Math.max(0, (score - 40) / 55))
  return Math.round(t * t * 100) / 100
}

export const isToday = (iso: string, now = new Date()): boolean => new Date(iso).toDateString() === now.toDateString()

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
