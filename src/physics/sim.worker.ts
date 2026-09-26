/**
 * Runs the paste simulation off the main thread. The page keeps a mirror PasteSimulation for
 * rendering and asks for time to advance; each reply carries the new state and only the field
 * tiles that changed (transferred, not copied).
 *
 *  → { type: 'init', gen, set, kin, phys, startTime }
 *  → { type: 'advance', gen, target, maxSteps }   step until t reaches target (at most maxSteps)
 *  → { type: 'stop' }
 *  ← { gen, snap: SimSnapshot, capped }           capped: stopped at maxSteps, behind target
 */
import type { StrokeSet } from '../lettering/types'
import type { KinematicsParams } from './kinematics'
import type { PhysicsParams } from './params'
import { PasteSimulation } from './simulation'

type Msg =
  | { type: 'init'; gen: number; set: StrokeSet; kin: KinematicsParams; phys: PhysicsParams; startTime: number }
  | { type: 'advance'; gen: number; target: number; maxSteps: number }
  | { type: 'stop' }

let sim: PasteSimulation | null = null
let gen = -1

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data
  if (m.type === 'init') {
    gen = m.gen
    sim = new PasteSimulation(m.set, m.kin, m.phys, m.startTime)
    sim.field.takeDirty(0) // the mirror starts from the same empty field
  } else if (m.type === 'advance') {
    if (!sim || m.gen !== gen) return
    let n = 0
    while (sim.t + sim.dt <= m.target && n < m.maxSteps) {
      sim.step()
      n++
    }
    const snap = sim.snapshot()
    const transfer = [snap.tiles.buffer, snap.cells.buffer, snap.thread.pos.buffer, snap.thread.radius.buffer]
    ;(self as unknown as Worker).postMessage({ gen, snap, capped: n >= m.maxSteps }, transfer)
  } else {
    sim = null
    gen = -1
  }
}
