// Renderiza build/logo.svg em PNG 512 (Edge do sistema) e monta o .ico com PNGs embutidos.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
const root = process.argv[2]
const svg = readFileSync(`${root}/build/logo.svg`, 'utf8')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
const sizes = [512, 256, 64, 48, 32, 16]
const pngs = {}
for (const s of sizes) {
  await page.setViewportSize({ width: s, height: s })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${s}" height="${s}"`)}</body></html>`)
  pngs[s] = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } })
}
await browser.close()
writeFileSync(`${root}/build/icon.png`, pngs[512])
writeFileSync(`${root}/resources/icon.png`, pngs[256])
const icoSizes = [256, 64, 48, 32, 16]
const header = Buffer.alloc(6 + 16 * icoSizes.length)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4)
let offset = header.length
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16, data = pngs[s]
  header.writeUInt8(s === 256 ? 0 : s, e); header.writeUInt8(s === 256 ? 0 : s, e + 1)
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += data.length
})
writeFileSync(`${root}/build/icon.ico`, Buffer.concat([header, ...icoSizes.map((s) => pngs[s])]))
console.log('ok', Object.fromEntries(sizes.map((s) => [s, pngs[s].length])))
