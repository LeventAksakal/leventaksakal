// Captures the stroke lab at several timeline positions (vite preview must be running on :4173).
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/lab/strokes/'
const out = process.argv[3] ?? 'tools/out'
const browser = await chromium.launch()
const page = await browser.newPage({ ignoreHTTPSErrors: true, ...({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }) })
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()))
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.goto(url)
await page.evaluate(() => document.fonts.ready)
await page.click('#play') // pause
for (const f of [0.08, 0.3, 0.55, 0.8, 1.0]) {
  await page.$eval('#scrub', (el, v) => { el.value = String(Math.round(v * 1000)); el.dispatchEvent(new Event('input')) }, f)
  await page.waitForTimeout(120)
  await page.locator('.stage').screenshot({ path: `${out}/lab-t${Math.round(f * 100)}.png` })
}
await page.screenshot({ path: `${out}/lab-full.png`, fullPage: true })
const mobile = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await mobile.goto(url); await mobile.evaluate(() => document.fonts.ready); await mobile.waitForTimeout(600)
await mobile.screenshot({ path: `${out}/lab-mobile.png`, fullPage: true })
const sw = await mobile.evaluate(() => document.documentElement.scrollWidth)
console.log('mobile scrollWidth', sw)
await browser.close()
