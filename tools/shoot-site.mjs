// Screenshots of the home page: intro beats (wall-clock seconds), then the final state.
// Usage: node tools/shoot-site.mjs <url> <out-prefix> <WxH> <intro seconds, comma list | "">
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
const out = process.argv[3] ?? 'tools/out/site'
const [w, h] = (process.argv[4] ?? '1280x720').split('x').map(Number)
const beats = (process.argv[5] ?? '3,9').split(',').filter(Boolean).map(Number)
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true })
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
await page.goto(url)
await page.waitForFunction(() => window.site, null, { timeout: 900000 })
const t0 = Date.now()
for (const b of beats) {
  // wait until the simulation clock passes the beat (headless rendering is slow)
  await page.waitForFunction((b) => window.site.time >= b || window.site.phase !== 'intro', b, { timeout: 300000, polling: 200 })
  await page.screenshot({ path: `${out}-intro-${b}.png`, timeout: 180000 })
  console.log(`beat ${b}s (wall ${((Date.now() - t0) / 1000).toFixed(1)} s) phase`, await page.evaluate(() => window.site.phase))
}
if (beats.length) {
  await page.waitForFunction(() => window.site.phase !== 'intro', null, { timeout: 600000, polling: 500 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}-transition.png`, timeout: 180000 })
}
await page.evaluate(() => window.site.skip())
await page.waitForFunction(() => window.site.phase === 'final', null, { timeout: 180000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}-final.png`, timeout: 180000 })
console.log(logs.filter((l) => !l.includes('GPU stall') && !l.includes('WebGPU')).slice(0, 12).join('\n'))
await browser.close()
