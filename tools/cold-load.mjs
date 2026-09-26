// Cold first visit (fresh profile, no localStorage) timeline: phase, sim time and a screenshot
// every `step` seconds, plus console errors. Usage: node tools/cold-load.mjs <url> <outPrefix> [webgpu|webgl] [seconds]
import { chromium } from 'playwright'
const [url, out, backend = 'webgpu', secs = '40', size = '960x600'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const args = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.GPULOG ? ['--enable-logging=stderr', '--v=0'] : [])]
if (backend === 'webgpu') args.push('--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader')
const b = await chromium.launch({ args })
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
const t0 = Date.now()
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5), ...a)
p.on('pageerror', (e) => log('pageerror', e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && log(m.type(), m.text().slice(0, 200)))
p.on('requestfinished', (r) => { if (/\.(js|gz|woff2)$/.test(r.url())) log('loaded', r.url().split('/').pop()) })
const target = url + (backend === 'webgl' ? (url.includes('?') ? '&' : '?') + 'webgl' : '')
await p.goto(target)
let i = 0
while ((Date.now() - t0) / 1000 < Number(secs)) {
  const s = await p.evaluate(() => (window.site ? { phase: window.site.phase, t: +window.site.time.toFixed(2), backend: window.site.world?.stage?.backend, fade: +(window.site.world?.post?.uniforms.fade.value ?? -1).toFixed(2) } : 'booting'))
  if (!process.env.NOSHOTS) await p.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.png` })
  log('state', JSON.stringify(s), `→ ${out.split('/').pop()}-${String(i).padStart(2, '0')}.png`)
  i++
  await p.waitForTimeout(2000)
}
await b.close()
