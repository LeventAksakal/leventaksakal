// Final-state screenshot (skips the intro via ?final) and, optionally, a crop of the name.
import { chromium } from 'playwright'
const [url, out, size, crop] = process.argv.slice(2)
const [w, h] = (size ?? '390x844').split('x').map(Number)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, ignoreHTTPSErrors: true })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(url)
await p.waitForFunction(() => window.site?.phase === 'final', null, { timeout: 900000, polling: 500 })
await p.waitForTimeout(3000)
await p.screenshot({ path: out, timeout: 300000 })
if (crop) {
  const r = await p.$eval('#home', (e) => e.getBoundingClientRect().toJSON())
  await p.screenshot({ path: crop, clip: { x: r.x, y: r.y, width: r.width, height: r.height }, timeout: 300000 })
  console.log('name rect', JSON.stringify(r))
}
console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'of', w)
await b.close()
