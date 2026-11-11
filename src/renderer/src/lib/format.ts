import type { JobStatus } from '../../../shared/types'

export const STATUS_LABEL: Record<JobStatus, string> = {
  nova: 'Nova',
  salva: 'Salva',
  aplicada: 'Aplicada',
  entrevista: 'Entrevista',
  descartada: 'Descartada'
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
