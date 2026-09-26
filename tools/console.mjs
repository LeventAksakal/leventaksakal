// Prints a page's console output and errors for N seconds.
import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 960, height: 540 } })
const t0 = Date.now()
p.on('console', (m) => console.log(((Date.now() - t0) / 1000).toFixed(1), m.type(), m.text().slice(0, 300)))
p.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')))
p.on('requestfailed', (r) => console.log('requestfailed', r.url().slice(0, 120), r.failure()?.errorText))
await p.goto(process.argv[2])
await p.waitForTimeout(Number(process.argv[3] ?? 30) * 1000)
console.log('site?', await p.evaluate(() => !!window.site))
await b.close()
