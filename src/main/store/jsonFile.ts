import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_ATTEMPTS = 5
const RENAME_WAIT_MS = 40

const blockFor = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Renomeia tentando de novo quando o Windows nega por um instante (antivírus ou indexador lendo o arquivo).
 * Espera curta e síncrona, como a escrita; só acontece no caso de erro.
 */
export function renameWithRetry(from: string, to: string, rename = renameSync, wait = blockFor): void {
  for (let attempt = 1; ; attempt++) {
    try {
      rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? ''
      if (!RETRYABLE.has(code) || attempt >= RENAME_ATTEMPTS) throw error
      wait(RENAME_WAIT_MS * attempt)
    }
  }
}

/**
 * Um arquivo JSON local com leitura validada e escrita atômica (grava em .tmp e renomeia).
 * - Arquivo inexistente: valor padrão.
 * - Conteúdo corrompido: o arquivo é guardado como ".corrompido-<data>" e o app segue com o padrão.
 * - Falha de leitura (arquivo bloqueado etc.): erro — nunca sobrescreve dados que não conseguiu ler.
 */
export class JsonFile<T> {
  constructor(
    private readonly path: string,
    private readonly parse: (raw: unknown) => T,
    private readonly fallback: () => T
  ) {}

  read(): T {
    let text: string
    try {
      text = readFileSync(this.path, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return this.fallback()
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Não foi possível ler ${basename(this.path)} (${reason}). Tente de novo em instantes.`)
    }
    try {
      return this.parse(JSON.parse(text))
    } catch {
      this.quarantine()
      return this.fallback()
    }
  }

  write(value: T): void {
    mkdirSync(dirname(this.path), { recursive: true })
    const tmpPath = `${this.path}.tmp`
    writeFileSync(tmpPath, JSON.stringify(value), 'utf8')
    renameWithRetry(tmpPath, this.path)
  }

  update(change: (current: T) => T): T {
    const next = change(this.read())
    this.write(next)
    return next
  }

  private quarantine(): void {
    try {
      renameSync(this.path, `${this.path}.corrompido-${Date.now()}`)
    } catch {
      // Se nem renomear for possível, a próxima escrita substitui o conteúdo ilegível.
    }
  }
}
