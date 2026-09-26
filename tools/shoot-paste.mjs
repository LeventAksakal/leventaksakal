// Screenshots of the paste lab at given simulation times (dev server on :5173).
// Usage: node tools/shoot-paste.mjs <url> <t1,t2,..> <outPrefix> <WxH> '<look JSON>'
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:5173/lab/paste/?dpr=1&lowres'
const times = (process.argv[3] ?? '20').split(',').map(Number)
const out = process.argv[4] ?? 'tools/out/paste'
const size = (process.argv[5] ?? '1280x720').split('x').map(Number)
const look = JSON.parse(process.argv[6] ?? '{}')
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => { if (m.type() === 'error') logs.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
await page.goto(base, { waitUntil: 'load' })
await page.waitForFunction(() => window.lab?.ready?.(), null, { timeout: 180000 })
await page.evaluate((o) => { window.lab.look(o); document.querySelector('#gui').style.display = 'none' }, look)
for (const t of times) {
  await page.evaluate((t) => window.lab.seek(t), t)
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${out}-${String(t).replace('.', '_')}.png`, timeout: 180000 })
  console.log(`t=${t}`)
}
console.log(logs.slice(0, 10).join('\n'))
await browser.close()
