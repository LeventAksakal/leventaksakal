// Deterministic frame capture of the intro (site ?capture mode) → PNG sequence.
// Usage: node tools/capture.mjs <outDir> <fps> <from> <to> <WxH> [followWidthMetres]
import { chromium } from 'playwright'
import fs from 'node:fs'
const [outDir, fps = '12', from = '-0.9', to = '14', size = '960x540', follow, base = 'http://127.0.0.1:5173/'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
fs.mkdirSync(outDir, { recursive: true })
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(base + '?capture&quality=medium')
await p.waitForFunction(() => window.site?.step, null, { timeout: 900000 })
await p.evaluate(() => { document.querySelector('#skip')?.remove(); document.querySelector('#home')?.remove() })
if (follow) await p.evaluate((w) => window.site.follow(true, w), Number(follow))
const dt = 1 / Number(fps)
let t = await p.evaluate(() => window.site.time)
if (Number(from) > t) t = await p.evaluate((d) => window.site.step(d), Number(from) - t)
let i = 0
const t0 = Date.now()
while (t < Number(to)) {
  t = await p.evaluate((d) => window.site.step(d), dt)
  await p.screenshot({ path: `${outDir}/f${String(i).padStart(4, '0')}.png`, timeout: 120000 })
  i++
}
console.log(`${i} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
await b.close()
