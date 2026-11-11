import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonFile } from './jsonFile'

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
