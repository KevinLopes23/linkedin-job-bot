/** Detecção simples de idioma da vaga (palavras funcionais mais comuns de cada língua). */

/** Palavras que só aparecem num dos idiomas (evita "a", "do", "no", que existem nos dois). */
const ENGLISH = new Set([
  'the', 'and', 'to', 'of', 'with', 'you', 'we', 'our', 'for', 'is', 'are', 'will', 'your', 'this', 'in',
  'be', 'on', 'have', 'who', 'looking', 'experience', 'team', 'work', 'about', 'skills', 'requirements'
])
const PORTUGUESE = new Set([
  'de', 'que', 'para', 'com', 'não', 'uma', 'os', 'das', 'dos', 'em', 'você', 'vaga', 'experiência', 'conhecimento',
  'trabalho', 'empresa', 'nossa', 'nosso', 'será', 'ou', 'ao', 'pessoa', 'equipe', 'atuar', 'requisitos', 'sobre', 'e'
])
/** Abaixo disso não há evidência suficiente para descartar a vaga. */
const MIN_HITS = 6

/** `true` só quando a maioria clara das palavras funcionais é inglês. */
export function isEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zà-ú]+/g) ?? []
  let en = 0
  let pt = 0
  for (const word of words) {
    if (ENGLISH.has(word)) en++
    else if (PORTUGUESE.has(word)) pt++
  }
  return en >= MIN_HITS && en > pt * 2
}
