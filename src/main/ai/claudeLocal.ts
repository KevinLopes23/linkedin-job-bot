/**
 * Motor "Claude local": usa o CLI do Claude Code instalado nesta máquina (modo headless `claude -p`)
 * para dar a nota de match vaga × currículo, no lugar da API do Gemini. Roda sob a assinatura do
 * usuário (sem chave paga). Para gastar o mínimo, avalia TODAS as vagas da varredura numa única chamada.
 */
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { Job, Match } from '../../shared/types'
import type { Scorer, ScoreHooks } from '../scan/scanService'
import { INSTRUCTIONS, parseMatchResponse, sanitize } from './gemini'

/** Modelos oferecidos; Haiku é o padrão por ser barato e rápido. */
export const CLAUDE_MODELS = ['haiku', 'sonnet', 'opus'] as const

const CLAUDE_TIMEOUT_MS = 180_000
const MAX_RESUME_CHARS = 12_000
const MAX_DESC_CHARS = 2_000
const CLAUDE_FAIL = 'A análise pelo Claude local falhou'

/** Executa o Claude headless e devolve o TEXTO da resposta (campo `result` do JSON do CLI). */
export type ClaudeRunner = (prompt: string, model: string) => Promise<string>

const BATCH_INSTRUCTIONS = `${INSTRUCTIONS}

Você vai avaliar VÁRIAS vagas contra o MESMO currículo. Responda APENAS com um ARRAY JSON — um objeto por vaga, NA MESMA ORDEM e na mesma quantidade. Não escreva nada fora do array nem use blocos de markdown.
Cada objeto: score (inteiro 0-100), strengths (string[], até 4 pontos fortes para a vaga), gaps (string[], até 4 lacunas), summary (string curta, até 140 caracteres, dizendo se vale aplicar).`

function vagaBlock(job: Job, index: number): string {
  const description = (job.description || '(sem descrição)').slice(0, MAX_DESC_CHARS)
  const text = sanitize(`Cargo: ${job.title}\nEmpresa: ${job.company}\nLocal: ${job.location} (${job.model})\nDescrição:\n${description}`)
  return `<vaga indice="${index}">\n${text}\n</vaga>`
}

function buildBatchPrompt(jobs: readonly Job[], resume: string): string {
  const curriculo = `<curriculo>\n${sanitize(resume.slice(0, MAX_RESUME_CHARS))}\n</curriculo>`
  const vagas = jobs.map((job, index) => vagaBlock(job, index))
  return `${BATCH_INSTRUCTIONS}\n\n${curriculo}\n\nSão ${jobs.length} vaga(s):\n\n${vagas.join('\n\n')}`
}

/** Pega o array JSON da resposta, tolerando texto ou cercas de markdown em volta. */
function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) throw new Error('resposta sem array JSON')
  return JSON.parse(text.slice(start, end + 1))
}

export class ClaudeLocalScorer implements Scorer {
  readonly label = 'Claude'

  constructor(
    private readonly model: string,
    private readonly run: ClaudeRunner = spawnClaude
  ) {}

  async scoreAll(jobs: readonly Job[], resume: string, hooks?: ScoreHooks): Promise<Map<string, Match>> {
    const out = new Map<string, Match>()
    if (jobs.length === 0) return out
    const parsed = await this.callAndParse(jobs, resume)
    const items = Array.isArray(parsed) ? parsed : []
    jobs.forEach((job, index) => {
      try {
        out.set(job.id, parseMatchResponse(JSON.stringify(items[index] ?? null)))
      } catch {
        hooks?.onWarn?.(`a vaga "${job.title}" veio num formato inesperado do Claude.`)
      }
      hooks?.onProgress?.(index + 1, jobs.length)
    })
    return out
  }

  /** Nota de uma vaga só (botão "Analisar"): usa o mesmo caminho em lote com uma vaga. */
  async scoreJob(job: Job, resume: string): Promise<Match> {
    const match = (await this.scoreAll([job], resume)).get(job.id)
    if (!match) throw new Error(`${CLAUDE_FAIL}: o Claude não retornou nota para esta vaga.`)
    return match
  }

  private async callAndParse(jobs: readonly Job[], resume: string): Promise<unknown> {
    let answer: string
    try {
      answer = await this.run(buildBatchPrompt(jobs, resume), this.model)
    } catch (error) {
      throw new Error(`${CLAUDE_FAIL}: ${error instanceof Error ? error.message : String(error)}`)
    }
    try {
      return extractJsonArray(answer)
    } catch (error) {
      throw new Error(`${CLAUDE_FAIL}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/** Teste rápido do Claude local (botão "Testar Claude" nas Configurações). */
export async function testClaudeLocal(model: string, run: ClaudeRunner = spawnClaude): Promise<string> {
  const answer = await run('Responda apenas: ok', model)
  return answer.trim().slice(0, 50) || 'ok'
}

function claudeSpawnError(error: NodeJS.ErrnoException): string {
  if (error.code === 'ENOENT') {
    return 'Claude Code não encontrado. Abra o Claude Code uma vez e confirme que o comando "claude" funciona neste PC.'
  }
  return error.message
}

function extractResult(stdout: string): string {
  const parsed = JSON.parse(stdout) as { result?: unknown }
  if (typeof parsed.result !== 'string') throw new Error('resposta do Claude sem campo result')
  return parsed.result
}

/** Dispara `claude -p --output-format json --model <m>`, com o prompt pela entrada padrão. */
function spawnClaude(prompt: string, model: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const bin = process.env['CLAUDE_BIN'] || 'claude'
    const child = spawn(bin, ['-p', '--output-format', 'json', '--model', model], {
      cwd: tmpdir(), // diretório neutro: não carrega CLAUDE.md nem regras do projeto (mais barato e isolado)
      shell: true, // no Windows o executável é claude.cmd; os argumentos são fixos (o texto vai por stdin)
      windowsHide: true,
      env: process.env
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('o Claude demorou demais para responder'))
    }, CLAUDE_TIMEOUT_MS)
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(new Error(claudeSpawnError(error)))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(stderr.trim().slice(0, 200) || `o Claude saiu com código ${code}`))
      try {
        resolve(extractResult(stdout))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    child.stdin.end(prompt)
  })
}
