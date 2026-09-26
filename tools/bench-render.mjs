// Frame-cost benchmark in capture mode (headless; SwiftShader GPU numbers are inflated, CPU ones are real).
// Usage: node tools/bench-render.mjs <baseUrl> [WxH] [quality]
// Intro: per-frame sim / sync / render (GPU-synced) at t = 3..6 s. Final: cost of one re-render.
import { chromium } from 'playwright'
const [base = 'http://127.0.0.1:4173/', size = '1280x720', quality = 'high'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()))
await p.goto(`${base}?capture&webgl&quality=${quality}`)
await p.waitForFunction(() => window.site?.step, null, { timeout: 600000 })
const r = await p.evaluate(async () => {
  const world = window.site.world
  const rb = world.renderer.backend
  const gpuSync = async () => {
    if (rb.gl) rb.gl.readPixels(0, 0, 1, 1, rb.gl.RGBA, rb.gl.UNSIGNED_BYTE, new Uint8Array(4))
    else await rb.device.queue.onSubmittedWorkDone()
  }
  const sim = world.sim
  // warm-up: get paste on the paper, compile everything
  sim.advanceTo(3)
  world.sync(1 / 60)
  world.render()
  await gpuSync()
  world.render()
  await gpuSync()
  const n = 40
  const t = { sim: 0, sync: 0, render: 0, gpu: 0, worstSim: 0 }
  for (let i = 0; i < n; i++) {
    let a = performance.now()
    sim.advanceTo(sim.t + 3 / 60) // 3 s over 40 frames: covers writing at speed
    const ds = performance.now() - a
    t.sim += ds
    t.worstSim = Math.max(t.worstSim, ds)
    a = performance.now()
    world.sync(1 / 60)
    t.sync += performance.now() - a
    a = performance.now()
    world.render()
    t.render += performance.now() - a
    a = performance.now()
    await gpuSync()
    t.gpu += performance.now() - a
  }
  const intro = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +(k === 'worstSim' ? v : v / n).toFixed(2)]))
  intro.frames = n
  intro.backend = rb.gl ? 'WebGL2' : 'WebGPU'
  intro.dpr = world.dpr
  intro.calls = world.renderer.info.render.drawCalls
  await window.site.skip()
  await gpuSync()
  let a = performance.now()
  for (let i = 0; i < 10; i++) {
    world.render()
    await gpuSync()
  }
  const final = +((performance.now() - a) / 10).toFixed(2)
  return { intro, finalRenderMs: final }
})
console.log(JSON.stringify(r))
await b.close()
