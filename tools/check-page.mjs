// Loads a standalone HTML file headlessly and reports errors + whether the lab booted.
import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 900, height: 520 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto('file://' + process.argv[2])
const ok = await p.waitForFunction(() => window.lab?.ready?.(), null, { timeout: 120000 }).then(() => true, () => false)
await p.waitForTimeout(8000)
await p.screenshot({ path: process.argv[3] ?? 'tools/out/check.png', timeout: 120000 })
console.log('booted', ok, 'errors', errs.slice(0, 5))
await b.close()
