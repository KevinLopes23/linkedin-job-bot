import { describe, expect, it, vi } from 'vitest'
import type { Job } from '../../shared/types'
import { ClaudeLocalScorer, testClaudeLocal, type ClaudeRunner } from './claudeLocal'

const job = (id: string, title: string): Job => ({
  id,
  title,
  company: 'Empresa X',
  location: 'Remoto',
  model: 'Remoto',
  link: `https://www.linkedin.com/jobs/view/${id}`,
  searchKind: 'remoto',
  description: 'React, TypeScript, Node. Vaga remota.',
  applicants: 10,
  foundAt: '2026-11-12T00:00:00.000Z',
  status: 'nova',
  history: [],
  notes: '',
  match: null
})

const answer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  score: 82,
  strengths: ['Forte em React e TypeScript', 'Experiência com Node'],
  gaps: ['Sem AWS citada'],
  summary: 'Vale aplicar: stack alinhada.',
  ...over
})

const RESUME = 'Desenvolvedor full-stack: React, TypeScript, Node, 5 anos.'

describe('ClaudeLocalScorer.scoreAll', () => {
  it('avalia todas as vagas numa chamada só, com o currículo uma vez, e pede array JSON', async () => {
    let prompt = ''
    const run: ClaudeRunner = async (p) => {
      prompt = p
      return JSON.stringify([answer(), answer({ score: 40 })])
    }
    const result = await new ClaudeLocalScorer('haiku', run).scoreAll([job('10001', 'Front-end'), job('10002', 'Back-end')], RESUME)
    expect(prompt).toContain('<curriculo>')
    expect(prompt).toContain('React, TypeScript, Node, 5 anos')
    expect(prompt).toContain('Front-end')
    expect(prompt).toContain('Back-end')
    expect(prompt).toMatch(/ARRAY JSON/i)
    expect(result.get('10001')?.score).toBe(82)
    expect(result.get('10002')?.score).toBe(40)
  })

  it('tolera cercas de markdown em volta do array', async () => {
    const run: ClaudeRunner = async () => '```json\n' + JSON.stringify([answer()]) + '\n```'
    const result = await new ClaudeLocalScorer('haiku', run).scoreAll([job('10001', 'Dev')], RESUME)
    expect(result.get('10001')?.score).toBe(82)
  })

  it('se vier menos notas que vagas, mapeia as que deu e avisa as que faltaram', async () => {
    const run: ClaudeRunner = async () => JSON.stringify([answer()])
    const warns: string[] = []
    const result = await new ClaudeLocalScorer('haiku', run).scoreAll([job('10001', 'Dev A'), job('10002', 'Dev B')], RESUME, {
      onWarn: (m) => warns.push(m)
    })
    expect(result.has('10001')).toBe(true)
    expect(result.has('10002')).toBe(false)
    expect(warns.some((w) => w.includes('Dev B'))).toBe(true)
  })

  it('resposta sem array JSON vira erro claro (varredura segue sem nota)', async () => {
    const run: ClaudeRunner = async () => 'não consegui'
    await expect(new ClaudeLocalScorer('haiku', run).scoreAll([job('10001', 'Dev')], RESUME)).rejects.toThrow(/Claude local falhou/)
  })

  it('sem vagas, não chama o Claude', async () => {
    const run = vi.fn<ClaudeRunner>(async () => '[]')
    const result = await new ClaudeLocalScorer('haiku', run).scoreAll([], RESUME)
    expect(run).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })
})

describe('ClaudeLocalScorer.scoreJob', () => {
  it('nota de uma vaga só usa o mesmo caminho em lote', async () => {
    const run: ClaudeRunner = async () => JSON.stringify([answer({ score: 77 })])
    const match = await new ClaudeLocalScorer('haiku', run).scoreJob(job('10001', 'Dev'), RESUME)
    expect(match.score).toBe(77)
  })

  it('se o Claude não retorna nota, erro claro', async () => {
    const run: ClaudeRunner = async () => '[]'
    await expect(new ClaudeLocalScorer('haiku', run).scoreJob(job('10001', 'Dev'), RESUME)).rejects.toThrow(/não retornou nota/)
  })
})

describe('testClaudeLocal', () => {
  it('devolve a resposta curta do Claude', async () => {
    const run: ClaudeRunner = async (prompt) => (prompt.includes('ok') ? 'ok' : 'erro')
    expect(await testClaudeLocal('haiku', run)).toBe('ok')
  })
})
