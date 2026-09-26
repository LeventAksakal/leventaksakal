// Final state: count WebGL renders while the page is scrolled top to bottom (expected: 0).
import { chromium } from 'playwright'
const [base = 'http://127.0.0.1:4173/'] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(`${base}?final&webgl`)
await p.waitForFunction(() => window.site?.phase === 'final', null, { timeout: 600000 })
// let the fade-in tween finish (slow frames under SwiftShader)
await p.waitForTimeout(12000)
const r = await p.evaluate(async () => {
  const world = window.site.world
  let renders = 0
  const f = world.render.bind(world)
  world.render = () => { renders++; f() }
  const main = document.querySelector('#main')
  const t0 = performance.now()
  for (let y = 0; y <= main.scrollHeight; y += 40) {
    main.scrollTop = y
    await new Promise((r) => requestAnimationFrame(r))
  }
  const ms = performance.now() - t0
  return { renders, scrollFrames: Math.round(ms / 16.7), dimOpacity: document.querySelector('#dim') ? getComputedStyle(document.querySelector('#dim')).opacity : 'n/a' }
})
console.log(JSON.stringify(r))
await b.close()
