/** Texto do currículo em PDF (unpdf, sem binário nativo). */
export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_RESUME_CHARS = 40_000

export async function pdfToText(data: Uint8Array): Promise<string> {
  if (data.byteLength > MAX_PDF_BYTES) throw new Error('PDF muito grande (máx. 10 MB).')
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) throw new Error('Não encontrei texto no PDF (pode ser imagem escaneada). Cole o texto do currículo.')
  return clean.slice(0, MAX_RESUME_CHARS)
}
