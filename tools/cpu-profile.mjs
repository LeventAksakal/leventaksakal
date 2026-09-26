// JS CPU profile (V8 sampling) of the page from navigation until the intro starts; prints the
// hottest functions by self time. Usage: node tools/cpu-profile.mjs <url> [out.cpuprofile]
import { chromium } from 'playwright'
import fs from 'node:fs'
const [url, out] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage()
const cdp = await p.context().newCDPSession(p)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
await cdp.send('Profiler.start')
await p.goto(url)
await p.waitForFunction(() => window.site?.phase === 'intro' || window.site?.phase === 'final', null, { timeout: 300000, polling: 100 })
const { profile } = await cdp.send('Profiler.stop')
if (out) fs.writeFileSync(out, JSON.stringify(profile))
const self = new Map()
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const dt = new Map()
profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)))
let total = 0
for (const [id, t] of dt) {
  const f = byId.get(id).callFrame
  if (['(idle)', '(program)'].includes(f.functionName)) continue
  total += t
  const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`
  self.set(k, (self.get(k) ?? 0) + t)
}
console.log(`JS samples total ${(total / 1000).toFixed(0)} ms`)
for (const [k, t] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(t / 1000).toFixed(0).padStart(6)} ms  ${k}`)
await b.close()
