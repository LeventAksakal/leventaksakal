/**
 * Runs the paste simulation off the main thread. The page keeps a mirror PasteSimulation for
 * rendering and moves a target time forward every frame; the worker steps toward it in short
 * time slices and replies after each one with the new state and only the field tiles that
 * changed (transferred, not copied). Short slices keep updates smooth when the page asks for
 * more than the CPU can do (fast-forward on a slow machine): the page then just gets a slower
 * fast-forward, not a jerky one.
 *
 *  → { type: 'init', gen, set, kin, phys, startTime }
 *  → { type: 'target', gen, t }     simulate up to time t (may be sent every frame)
 *  → { type: 'stop' }
 *  ← { gen, snap: SimSnapshot }
 */
import type { StrokeSet } from '../lettering/types'
import type { KinematicsParams } from './kinematics'
import type { PhysicsParams } from './params'
import { PasteSimulation } from './simulation'

type Msg =
  | { type: 'init'; gen: number; set: StrokeSet; kin: KinematicsParams; phys: PhysicsParams; startTime: number }
  | { type: 'target'; gen: number; t: number }
  | { type: 'stop' }

const SLICE_MS = 8

let sim: PasteSimulation | null = null
let gen = -1
let target = -Infinity
let pumping = false

function pump() {
  pumping = false
  if (!sim) return
  const end = performance.now() + SLICE_MS
  let n = 0
  while (sim.t + sim.dt <= target && (n < 2 || performance.now() < end)) {
    sim.step()
    n++
  }
  if (n === 0) return
  const snap = sim.snapshot()
  const transfer = [snap.tiles.buffer, snap.cells.buffer, snap.thread.pos.buffer, snap.thread.radius.buffer]
  ;(self as unknown as Worker).postMessage({ gen, snap }, transfer)
  if (sim.t + sim.dt <= target) schedule()
}

/** Continue after pending messages (a newer target, or stop) have been handled. */
function schedule() {
  if (pumping) return
  pumping = true
  setTimeout(pump, 0)
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data
  if (m.type === 'init') {
    gen = m.gen
    sim = new PasteSimulation(m.set, m.kin, m.phys, m.startTime)
    sim.field.takeDirty(0) // the mirror starts from the same empty field
    target = sim.t
  } else if (m.type === 'target') {
    if (!sim || m.gen !== gen) return
    target = m.t
    schedule()
  } else {
    sim = null
    gen = -1
  }
}
