// Records a scenario in full Chromium: screen video (webm), a Chrome performance trace (open it in
// DevTools → Performance, or https://ui.perfetto.dev) and a state timeline.
// Usage: node tools/record.mjs <url> <outDir> [--webgpu] [--ff=<s>] [--secs=<n>] [--size=WxH] [--cpu=<slowdown>]
//   --ff=<s>  click once (fast-forward) s seconds after the intro starts
import { chromium } from 'playwright'
import fs from 'node:fs'
const [url, out, ...rest] = process.argv.slice(2)
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const [w, h] = String(opt.size ?? '1280x720').split('x').map(Number)
fs.mkdirSync(out, { recursive: true })
const args = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
if (opt.webgpu) args.push('--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader')
const b = await chromium.launch({ channel: 'chromium', args })
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: w, height: h } } })
const p = await ctx.newPage()
if (opt.cpu) {
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(opt.cpu) })
}
const t0 = Date.now()
const lines = []
const log = (...a) => { const s = [((Date.now() - t0) / 1000).toFixed(2).padStart(6), ...a].join(' '); lines.push(s); console.log(s) }
p.on('pageerror', (e) => log('pageerror', e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && log(m.type(), m.text().slice(0, 160)))
await b.startTracing(p, {
  path: `${out}/trace.json`,
  screenshots: true,
  categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'blink.user_timing', 'gpu', 'disabled-by-default-devtools.screenshot', 'loading'],
})
await p.goto(url)
let introAt = null
let clicked = false
let last = ''
while ((Date.now() - t0) / 1000 < Number(opt.secs ?? 30)) {
  const s = await p.evaluate(() => (window.site ? `${window.site.phase} t=${window.site.time.toFixed(2)}` : 'booting')).catch(() => 'n/a')
  if (s !== last) log('state', s)
  last = s
  if (introAt === null && s.startsWith('intro')) introAt = Date.now()
  if (opt.ff && !clicked && introAt && Date.now() - introAt > Number(opt.ff) * 1000) {
    await p.mouse.click(w / 2, h / 2)
    clicked = true
    log('click: fast-forward')
  }
  await p.waitForTimeout(250)
}
const marks = await p.evaluate(() => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('boot:')).map((m) => [m.name, Math.round(m.startTime)])).catch(() => [])
let prevT = 0
for (const [n, t] of marks) { log(`${n.padEnd(20)} at ${String(t).padStart(6)} ms  (+${t - prevT} ms)`); prevT = t }
await b.stopTracing()
const video = p.video()
await ctx.close()
await b.close()
fs.renameSync(await video.path(), `${out}/video.webm`)
fs.writeFileSync(`${out}/timeline.txt`, lines.join('\n') + '\n')
console.log(`→ ${out}/video.webm, ${out}/trace.json, ${out}/timeline.txt`)
