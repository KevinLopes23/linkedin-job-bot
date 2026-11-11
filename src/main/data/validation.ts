/** Validação (zod) de tudo que entra pelo IPC ou vem dos arquivos locais. */
import { z } from 'zod'
import { JOB_STATUSES, type Job, type JobStatus, type ScanRecord, type Settings } from '../../shared/types'
import { DEFAULT_CITIES, DEFAULT_EXCLUDE_TERMS, DEFAULT_KEYWORDS, DEFAULT_TITLE_TERMS } from '../scan/filters'

export const DEFAULT_SETTINGS: Settings = {
  keywords: DEFAULT_KEYWORDS,
  searchRemote: true,
  cities: DEFAULT_CITIES,
  hoursWindow: 1,
  maxApplicants: 50,
  maxPerCompany: 3,
  titleTerms: DEFAULT_TITLE_TERMS,
  excludeTerms: DEFAULT_EXCLUDE_TERMS,
  delayMs: 5_000,
  autoScan: true,
  intervalMinutes: 60,
  notifyMinScore: 75,
  maxAiPerScan: 15,
  geminiModel: 'gemini-flash-latest',
  resumeText: ''
}

const isValidRegex = (source: string): boolean => {
  try {
    new RegExp(source, 'i')
    return true
  } catch {
    return false
  }
}

const cleanList = (max: number, itemMax: number) =>
  z
    .array(z.string())
    .transform((items) => [...new Set(items.map((i) => i.trim()).filter((i) => i.length > 0))])
    .pipe(z.array(z.string().max(itemMax)).max(max))

/** Grupo com quantificador repetido por outro quantificador, ex.: (a+)+ ou (\w*)* — pode travar o app (ReDoS). */
export const hasNestedQuantifier = (source: string): boolean => /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)[+*{]/.test(source)

const regexList = cleanList(300, 200)
  .refine((items) => items.every(isValidRegex), {
    message: 'Há um termo que não é uma expressão válida. Confira parênteses e colchetes.'
  })
  .refine((items) => !items.some(hasNestedQuantifier), {
    message: 'Há um termo com repetição dentro de repetição, como (a+)+, que pode travar o app. Simplifique o termo.'
  })

const d = DEFAULT_SETTINGS

export const settingsSchema = z.object({
  keywords: cleanList(30, 80).refine((k) => k.length > 0, { message: 'Informe ao menos uma palavra-chave.' }).default([...d.keywords]),
  searchRemote: z.boolean().default(d.searchRemote),
  cities: cleanList(10, 120).default([...d.cities]),
  hoursWindow: z.number().int().min(1).max(720).default(d.hoursWindow),
  maxApplicants: z.number().int().min(0).max(10_000).default(d.maxApplicants),
  maxPerCompany: z.number().int().min(1).max(50).default(d.maxPerCompany),
  titleTerms: regexList.refine((t) => t.length > 0, { message: 'Informe ao menos um termo de título.' }).default([...d.titleTerms]),
  excludeTerms: regexList.default([...d.excludeTerms]),
  delayMs: z.number().int().min(1_000).max(60_000).default(d.delayMs),
  autoScan: z.boolean().default(d.autoScan),
  intervalMinutes: z.number().int().min(15).max(24 * 60).default(d.intervalMinutes),
  notifyMinScore: z.number().int().min(0).max(100).default(d.notifyMinScore),
  maxAiPerScan: z.number().int().min(0).max(100).default(d.maxAiPerScan),
  geminiModel: z.string().trim().regex(/^[a-z0-9.-]{3,60}$/, 'Modelo inválido.').default(d.geminiModel),
  resumeText: z.string().max(40_000, 'Currículo muito longo (máx. 40 mil caracteres).').default(d.resumeText)
}).refine((s) => s.searchRemote || s.cities.length > 0, { message: 'Ative a busca remota ou informe ao menos uma cidade.' })

/** Configurações vindas do renderer: erro claro se inválidas. */
export function parseSettings(raw: unknown): Settings {
  const result = settingsSchema.safeParse(raw)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Configurações inválidas.')
  return result.data
}

/** Configurações do arquivo: o que não validar volta ao padrão. */
export function parseStoredSettings(raw: unknown): Settings {
  const result = settingsSchema.safeParse(raw)
  return result.success ? result.data : DEFAULT_SETTINGS
}

const statusSchema = z.enum(JOB_STATUSES)

export const matchSchema = z.object({
  score: z.number().int().min(0).max(100),
  strengths: z.array(z.string().max(300)).max(6),
  gaps: z.array(z.string().max(300)).max(6),
  summary: z.string().min(1).max(300),
  at: z.string()
})

const jobSchema = z.object({
  id: z.string().regex(/^\d{5,20}$/),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  model: z.enum(['Remoto', 'Híbrido', 'Presencial', 'Indefinido']),
  link: z.string(),
  searchKind: z.enum(['remoto', 'local']),
  description: z.string(),
  applicants: z.number().nullable(),
  foundAt: z.string(),
  status: statusSchema,
  history: z.array(z.object({ status: statusSchema, at: z.string() })),
  notes: z.string(),
  match: matchSchema.nullable()
})

/** Lê a lista de vagas descartando só os itens inválidos. */
export function parseJobs(raw: unknown): Job[] {
  if (!Array.isArray(raw)) throw new Error('jobs.json não é uma lista')
  return raw.flatMap((item) => {
    const r = jobSchema.safeParse(item)
    return r.success ? [r.data] : []
  })
}

const scanRecordSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string(),
  cards: z.number(),
  candidates: z.number(),
  added: z.number(),
  analyzed: z.number(),
  error: z.string().nullable()
})

export function parseScanHistory(raw: unknown): ScanRecord[] {
  if (!Array.isArray(raw)) throw new Error('scans.json não é uma lista')
  return raw.flatMap((item) => {
    const r = scanRecordSchema.safeParse(item)
    return r.success ? [r.data] : []
  })
}

export function parseJobId(raw: unknown): string {
  if (typeof raw !== 'string' || !/^\d{5,20}$/.test(raw)) throw new Error('Vaga inválida.')
  return raw
}

export function parseStatus(raw: unknown): JobStatus {
  const r = statusSchema.safeParse(raw)
  if (!r.success) throw new Error('Coluna inválida.')
  return r.data
}

export function parseNotes(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Anotação inválida.')
  if (raw.length > 5_000) throw new Error('Anotação muito longa (máx. 5 mil caracteres).')
  return raw
}
