// Final-state design review: first screen, then scrolled positions of the content box.
import { chromium } from 'playwright'
const [url, out, size, scrolls = '0'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(url)
await p.waitForFunction(() => window.site?.phase === 'final', null, { timeout: 900000, polling: 500 })
await p.waitForTimeout(2500)
for (const s of scrolls.split(',').map(Number)) {
  await p.evaluate((s) => { document.querySelector('#main').scrollTop = s }, s)
  await p.waitForTimeout(1800)
  await p.screenshot({ path: `${out}-${s}.png`, timeout: 300000 })
}
if (process.env.HOVER) {
  await p.evaluate(() => { document.querySelector('#main').scrollTop = 700 })
  await p.hover(process.env.HOVER)
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}-hover.png`, timeout: 300000 })
}
console.log('overflow-x', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))
await b.close()
