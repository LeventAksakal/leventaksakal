// Interaction test for the intro: hint, click to fast-forward, click again to skip; Escape skips.
import { chromium } from 'playwright'
const url = process.argv[2]
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const run = async (label, fn) => {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true })).newPage()
  p.on('pageerror', (e) => console.log(label, 'pageerror', e.message))
  await p.goto(url)
  await p.waitForFunction(() => window.site?.phase === 'intro' && window.site.time > 0.3, null, { timeout: 900000, polling: 300 })
  await fn(p)
  await p.close()
}
await run('click', async (p) => {
  await p.waitForFunction(() => document.querySelector('#hint').classList.contains('is-on'), null, { timeout: 120000 })
  console.log('hint:', await p.textContent('#hint'))
  await p.screenshot({ path: 'tools/out/intro-hint.png' })
  const t0 = await p.evaluate(() => window.site.time)
  await p.mouse.click(640, 360)
  await p.waitForTimeout(4000)
  const t1 = await p.evaluate(() => window.site.time)
  console.log('after 1st click: hint =', await p.textContent('#hint'), '| sim advanced', (t1 - t0).toFixed(2), 's in 4 s wall')
  await p.mouse.click(640, 360)
  await p.waitForFunction(() => window.site.phase === 'final', null, { timeout: 300000 })
  console.log('after 2nd click: phase final, skip link visible?', await p.isVisible('#skip-link'))
})
await run('escape', async (p) => {
  await p.keyboard.press('Escape')
  await p.waitForFunction(() => window.site.phase === 'final', null, { timeout: 300000 })
  console.log('escape: phase final')
})
await b.close()
