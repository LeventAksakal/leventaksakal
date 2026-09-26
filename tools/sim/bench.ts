// Times the site preset headless (relax share, worst step) and prints a field checksum,
// so a physics optimisation can be checked for identical (or near-identical) output.
import set from '../../src/lettering/NothingYouCouldDo.strokes.json'
import type { StrokeSet } from '../../src/lettering/types'
import { siteKinematics, sitePhysics } from '../../src/physics/preset'
import { PasteSimulation } from '../../src/physics/simulation'

const sim = new PasteSimulation(set as StrokeSet, siteKinematics, sitePhysics, -0.9)
const relax = sim.field.relax.bind(sim.field)
let relaxMs = 0
sim.field.relax = (dt, now, p) => {
  const a = performance.now()
  relax(dt, now, p)
  relaxMs += performance.now() - a
}
const t0 = performance.now()
let worst = 0
while (sim.t < sim.endTime) {
  const a = performance.now()
  sim.step()
  worst = Math.max(worst, performance.now() - a)
}
const ms = performance.now() - t0
const f = sim.field
let sum = 0
let sq = 0
let hmax = 0
for (let i = 0; i < f.h.length; i++) {
  sum += f.h[i]
  sq += f.h[i] * f.h[i] * (1 + (i % 7))
  hmax = Math.max(hmax, f.h[i])
}
console.log(`sim ${sim.t.toFixed(2)} s in ${ms.toFixed(0)} ms (relax ${relaxMs.toFixed(0)} ms), worst step ${worst.toFixed(1)} ms, ${sim.steps} steps`)
console.log(`checksum vol=${(sum * f.dx * f.dx * 1e6).toFixed(6)} ml  sq=${sq.toExponential(9)}  hmax=${(hmax * 1e3).toFixed(4)} mm`)
if (process.argv[2]) {
  const fs = await import('node:fs')
  fs.writeFileSync(process.argv[2], Buffer.from(f.h.buffer))
}
