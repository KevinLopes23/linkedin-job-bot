/**
 * Proteção contra termos de busca que travariam o app (ReDoS). Os termos são regex digitadas pelo usuário
 * e rodam no processo principal; uma regex com retrocesso exponencial congela app, bandeja e IPC.
 */

/** Tamanho de uma repetição variável em `source[i]` (+, *, {n,}, {n,m}); 0 se não houver. `{n}` fixo não conta. */
function variableQuantifierAt(source: string, i: number): number {
  const c = source[i]
  if (c === '+' || c === '*') return 1
  if (c !== '{') return 0
  const m = /^\{(\d+)(,(\d*))?\}/.exec(source.slice(i))
  if (!m || m[2] === undefined) return 0
  if (m[3] !== '' && m[3] === m[1]) return 0
  return m[0].length
}

/**
 * Grupo que contém repetição (direta ou num grupo de dentro) e é repetido de novo: (a+)+, (\w*)*, ((ab)+)+, (x|y+){2,}.
 * Contagem fixa como (a{2})+ não é perigosa e passa.
 */
export function hasNestedQuantifier(source: string): boolean {
  const stack: boolean[] = []
  let inClass = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '\\') {
      i++
      continue
    }
    if (inClass) {
      if (c === ']') inClass = false
      continue
    }
    if (c === '[') {
      inClass = true
      continue
    }
    if (c === '(') {
      stack.push(false)
      continue
    }
    if (c === ')') {
      const inner = stack.pop() ?? false
      const q = variableQuantifierAt(source, i + 1)
      if (q > 0 && inner) return true
      // O grupo inteiro repetido conta como repetição para o grupo de fora.
      if ((q > 0 || inner) && stack.length > 0) stack[stack.length - 1] = true
      if (q > 0) i += q
      continue
    }
    const q = variableQuantifierAt(source, i)
    if (q > 0) {
      if (stack.length > 0) stack[stack.length - 1] = true
      i += q - 1
    }
  }
  return false
}

const SLOW_MS = 25
const LENGTHS = [12, 18, 24, 30]

/** Strings adversárias curtas: repetições de pedaços comuns e das letras do próprio termo, terminando num caractere que falha. */
function adversarialInputs(source: string, length: number): string[] {
  const letters = [...new Set(source.toLowerCase().replace(/\\./g, '').match(/[a-z0-9]/g) ?? [])].slice(0, 4)
  const pieces = new Set(['a', 'ab', '1', ' ', '-', ...letters, letters.join('')].filter(Boolean))
  return [...pieces].map((p) => p.repeat(Math.ceil(length / p.length)).slice(0, length) + '!')
}

/**
 * Roda o termo contra entradas adversárias crescentes; lento demais (> 25 ms) duas vezes seguidas na mesma
 * entrada = perigoso. A segunda medição evita recusar por uma pausa do coletor de lixo.
 */
export function isSlowRegex(source: string, now: () => number = performance.now.bind(performance)): boolean {
  let re: RegExp
  try {
    re = new RegExp(source, 'i')
  } catch {
    return false
  }
  for (const length of LENGTHS) {
    for (const input of adversarialInputs(source, length)) {
      const slow = (): boolean => {
        const start = now()
        re.test(input)
        return now() - start > SLOW_MS
      }
      if (slow() && slow()) return true
    }
  }
  return false
}
