// Main-thread cost per intro frame in the real loop: time spent in sim stepping, sync and the
// render call (CPU submit), sampled over a stretch of the live intro. Headless, WebGL2.
import { chromium } from 'playwright'
const [base = 'http://127.0.0.1:4173/', size = '640x400'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto(`${base}?webgl&quality=low`)
await p.waitForFunction(() => window.site?.phase === 'intro' && window.site.time > 0.2, null, { timeout: 600000, polling: 200 })
const r = await p.evaluate(async () => {
  const world = window.site.world
  const t = { sim: 0, sync: 0, render: 0, frames: 0, worst: 0 }
  const wrap = (obj, name, key) => {
    const f = obj[name].bind(obj)
    obj[name] = (...a) => { const s = performance.now(); const r = f(...a); const d = performance.now() - s; t[key] += d; return r }
  }
  const sim = world.sim
  // old build steps the sim directly from main.ts; new build goes through world.advance
  if (world.advance) wrap(world, 'advance', 'sim')
  else wrap(sim, 'step', 'sim')
  wrap(world, 'sync', 'sync')
  wrap(world, 'render', 'render')
  let frames = 0
  let prev = { ...t }
  const t0 = world.sim.t
  await new Promise((res) => {
    const tick = () => {
      frames++
      const busy = t.sim + t.sync + t.render - (prev.sim + prev.sync + prev.render)
      t.worst = Math.max(t.worst, busy)
      prev = { ...t }
      if (frames < 60) requestAnimationFrame(tick)
      else res()
    }
    requestAnimationFrame(tick)
  })
  return { perFrame: { sim: +(t.sim / frames).toFixed(2), sync: +(t.sync / frames).toFixed(2), render: +(t.render / frames).toFixed(2) }, worstFrame: +t.worst.toFixed(1), simSecondsCovered: +(world.sim.t - t0).toFixed(2), frames }
})
console.log(JSON.stringify(r))
await b.close()
