// Headless run of the paste simulation: timing, mass balance, and a shaded height-map PNG.
import fs from 'node:fs'
import { PNG } from './png'
import set from '../../src/lettering/NothingYouCouldDo.strokes.json'
import { defaultKinematics } from '../../src/physics/kinematics'
import { defaultPhysics } from '../../src/physics/params'
import { PasteSimulation } from '../../src/physics/simulation'
import type { StrokeSet } from '../../src/lettering/types'

const kin = { ...defaultKinematics, nozzleHeight: 4, drawDuration: 12.5, liftMin: 0.22, liftMax: 0.45, areaRatioMax: 1.5 }
const sim = new PasteSimulation(set as StrokeSet, kin, defaultPhysics)
const t0 = performance.now()
const until = Number(process.argv[2] ?? sim.endTime)
let maxStep = 0
while (sim.t < until) {
  const a = performance.now(); sim.step(); maxStep = Math.max(maxStep, performance.now() - a)
}
const ms = performance.now() - t0
const f = sim.field
let hmax = 0
for (const v of f.h) hmax = Math.max(hmax, v)
console.log(`simulated ${sim.t.toFixed(2)} s in ${ms.toFixed(0)} ms (${sim.steps} steps, worst step ${maxStep.toFixed(1)} ms)`)
console.log(`plan: ${sim.plan.tEnd.toFixed(2)} s, ${sim.plan.lifts.length} lifts, U0 ${sim.plan.medianSpeed.toFixed(0)} mm/s`)
console.log(`volume: extruded ${(sim.stats.extruded * 1e6).toFixed(2)} ml, deposited ${(sim.stats.deposited * 1e6).toFixed(2)} ml, field ${(f.totalVolume() * 1e6).toFixed(2)} ml, squeeze ${(sim.squeeze * 100).toFixed(0)}%`)
console.log(`height max ${(hmax * 1e3).toFixed(2)} mm, field ${f.nx}x${f.nz}`)
// hillshade
const W = f.nx, H = f.nz, img = new Uint8Array(W * H * 3)
for (let k = 1; k < H - 1; k++) for (let i = 1; i < W - 1; i++) {
  const id = k * W + i, h = f.h[id]
  const gx = (f.h[id + 1] - f.h[id - 1]) / (2 * f.dx), gz = (f.h[id + W] - f.h[id - W]) / (2 * f.dx)
  const n = [-gx, 1, -gz], l = Math.hypot(...n)
  const shade = Math.max(0, (n[0] * -0.5 + n[1] * 0.7 + n[2] * -0.5) / l / 0.99)
  const o = id * 3
  if (h > 1e-6) { img[o] = 60 + 195 * shade; img[o + 1] = 40 + 150 * shade; img[o + 2] = 10 } else { img[o] = img[o + 1] = img[o + 2] = 28 }
}
fs.writeFileSync(process.argv[3] ?? 'tools/out/sim-height.png', PNG(W, H, img))
