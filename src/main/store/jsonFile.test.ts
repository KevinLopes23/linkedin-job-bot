import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonFile, renameWithRetry } from './jsonFile'

const parseNumbers = (raw: unknown): number[] =>
  Array.isArray(raw) ? raw.filter((v): v is number => typeof v === 'number') : []

describe('JsonFile', () => {
  let dir = ''

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  const makeFile = (): { file: JsonFile<number[]>; path: string } => {
    dir = mkdtempSync(join(tmpdir(), 'vagalume-json-'))
    const path = join(dir, 'data.json')
    return { file: new JsonFile(path, parseNumbers, () => []), path }
  }

  it('returns the fallback when the file does not exist', () => {
    expect(makeFile().file.read()).toEqual([])
  })

  it('writes and reads back through the parser', () => {
    const { file } = makeFile()
    file.write([1, 2, 3])
    expect(file.read()).toEqual([1, 2, 3])
  })

  it('returns the fallback for corrupted content and keeps a backup of it', () => {
    const { file, path } = makeFile()
    writeFileSync(path, 'not json')
    expect(file.read()).toEqual([])
    expect(readdirSync(dir).some((name) => name.startsWith('data.json.corrompido-'))).toBe(true)
  })

  it('throws instead of returning the fallback when the file cannot be read', () => {
    const { path } = makeFile()
    mkdirSync(path) // um diretório no lugar do arquivo provoca erro de leitura (EISDIR)
    const file = new JsonFile(path, parseNumbers, () => [])
    expect(() => file.read()).toThrow(/Não foi possível ler/)
    expect(() => file.update((c) => [...c, 1])).toThrow()
  })

  it('applies the parser to sanitize stored data', () => {
    const { file, path } = makeFile()
    writeFileSync(path, JSON.stringify([1, 'x', 2]))
    expect(file.read()).toEqual([1, 2])
  })

  it('updates with a function of the current value', () => {
    const { file } = makeFile()
    file.write([1])
    expect(file.update((current) => [...current, 2])).toEqual([1, 2])
    expect(file.read()).toEqual([1, 2])
  })
})

describe('renameWithRetry', () => {
  const busy = (code: string): Error => Object.assign(new Error(`${code}: operation not permitted, rename`), { code })

  it('tenta de novo em EPERM/EBUSY/EACCES e conclui', () => {
    const errors = [busy('EPERM'), busy('EBUSY'), busy('EACCES')]
    const calls: string[] = []
    const waits: number[] = []
    renameWithRetry('a.tmp', 'a', (from, to) => {
      calls.push(`${from}>${to}`)
      const e = errors.shift()
      if (e) throw e
    }, (ms) => waits.push(ms))
    expect(calls).toHaveLength(4)
    expect(waits).toEqual([40, 80, 120])
  })

  it('desiste depois de 5 tentativas e propaga o erro', () => {
    let calls = 0
    const rename = (): void => {
      calls++
      throw busy('EBUSY')
    }
    expect(() => renameWithRetry('a.tmp', 'a', rename, () => undefined)).toThrow(/EBUSY/)
    expect(calls).toBe(5)
  })

  it('erro que não é de arquivo ocupado falha na hora', () => {
    let calls = 0
    const rename = (): void => {
      calls++
      throw busy('ENOSPC')
    }
    expect(() => renameWithRetry('a.tmp', 'a', rename, () => undefined)).toThrow(/ENOSPC/)
    expect(calls).toBe(1)
  })
})
