import { describe, expect, it } from 'vitest'
import { MAX_PDF_BYTES, pdfToText } from './resumePdf'

/** PDF mínimo válido com uma linha de texto (Helvetica). */
function tinyPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(body)
}

describe('pdfToText', () => {
  it('extrai o texto do currículo', async () => {
    expect(await pdfToText(tinyPdf('Kevin Lopes - Desenvolvedor React e Node'))).toContain('Kevin Lopes - Desenvolvedor React e Node')
  })

  it('recusa PDF sem texto e PDF grande demais', async () => {
    await expect(pdfToText(tinyPdf(''))).rejects.toThrow(/Não encontrei texto/)
    await expect(pdfToText(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toThrow(/muito grande/)
  })
})
