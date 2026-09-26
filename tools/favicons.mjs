// Renders public/favicon.svg to the PNG sizes browsers and iOS ask for.
import { chromium } from 'playwright'
import fs from 'node:fs'
const svg = fs.readFileSync('public/favicon.svg', 'utf8')
const b = await chromium.launch()
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`)
  await p.screenshot({ path: `public/${name}`, omitBackground: true })
}
await b.close()
