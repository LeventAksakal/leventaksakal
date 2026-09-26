// Scans a full run for discontinuities that would read as glitches on screen.
import nycd from '../../src/lettering/NothingYouCouldDo.strokes.json'
import type { StrokeSet } from '../../src/lettering/types'
import { siteKinematics, sitePhysics } from '../../src/physics/preset'
import { PasteSimulation } from '../../src/physics/simulation'

const sim = new PasteSimulation(nycd as StrokeSet, siteKinematics, sitePhysics, -0.9)
const f = sim.field
let prevContact = { x: sim.contact.x, z: sim.contact.z }
let prevState = sim.thread.state
let prevMax = 0
const events: string[] = []
const th = sim.thread
const prevPos = new Float32Array(th.pos)
while (sim.t < sim.endTime) {
  sim.step()
  const t = sim.t.toFixed(3)
  const jump = Math.hypot(sim.contact.x - prevContact.x, sim.contact.z - prevContact.z) * 1000
  if (th.state === 'attached' && prevState === 'attached' && jump > 2) events.push(`${t} contact jump ${jump.toFixed(1)} mm`)
  if (th.state !== prevState) events.push(`${t} thread ${prevState} -> ${th.state} (phase ${sim.nozzle.phase}, stroke ${sim.nozzle.stroke})`)
  // thread node teleports while visible
  if (th.state !== 'none' && prevState === th.state) {
    let maxMove = 0
    for (let i = 0; i < th.n; i++) maxMove = Math.max(maxMove, Math.hypot(th.pos[i * 3] - prevPos[i * 3], th.pos[i * 3 + 1] - prevPos[i * 3 + 1], th.pos[i * 3 + 2] - prevPos[i * 3 + 2]))
    if (maxMove * 1000 > 6) events.push(`${t} thread node moved ${(maxMove * 1000).toFixed(1)} mm in one step (${th.state})`)
    let below = 0
    for (let i = 1; i < th.n - 1; i++) if (th.pos[i * 3 + 1] < f.sample(th.pos[i * 3], th.pos[i * 3 + 2]) - 0.0005) below++
    if (below) events.push(`${t} ${below} thread nodes inside the paste`)
    let nan = false
    for (const v of th.pos) if (!Number.isFinite(v)) nan = true
    if (nan) events.push(`${t} NaN in thread`)
  }
  if (sim.steps % 12 === 0) {
    let m = 0
    for (let i = 0; i < f.h.length; i++) {
      const v = f.h[i]
      if (!Number.isFinite(v)) { events.push(`${t} NaN height`); break }
      if (v > m) m = v
    }
    if (m - prevMax > 0.0015) events.push(`${t} max height +${((m - prevMax) * 1000).toFixed(2)} mm in 50 ms (now ${(m * 1000).toFixed(2)})`)
    prevMax = m
  }
  prevContact = { x: sim.contact.x, z: sim.contact.z }
  prevState = th.state
  prevPos.set(th.pos)
}
// collapse repeats
const out: string[] = []
for (const e of events) {
  const key = e.replace(/^[\d.-]+ /, '').replace(/[\d.]+ mm/g, 'N mm')
  const last = out[out.length - 1]
  if (last && last.includes(key.slice(0, 25)) && out.length > 0 && out.filter((o) => o.includes(key.slice(0, 25))).length > 3) continue
  out.push(e)
}
console.log(out.join('\n'))
console.log(`${events.length} events total`)
