/**
 * Tier-1 reduced-order paste simulation: kinematics → extrusion → touchdown → height field.
 *
 * Deterministic: fixed timestep, seeded RNG, no dependence on frame rate or wall clock,
 * so the settled result can be baked and matches the live run.
 *
 * Model per step (brief §2):
 *  - Extrusion Q follows the deposition law A = Q/U (from the kinematic plan).
 *  - The thread leaves the nozzle at v_e = Q / (π r_e²) (r_e includes die swell); the
 *    sewing-machine speed ratio V* = U / v_e picks the regime: dragged catenary (touchdown
 *    lags the nozzle) when V* ≳ 1, buckling into a small coil when V* < 1 (first touch,
 *    stroke starts, hesitations).
 *  - Touchdown lays the volume into the height field; the Bingham thin layer settles it.
 *  - Pen lifts: the tube stops squeezing, the thread stretches, necks and snaps; the lower
 *    part falls back as a standing tail peak held up by the yield stress.
 */
import type { StrokeSet } from '../lettering/types'
import { HeightField } from './heightfield'
import { planWriting, sampleNozzle, type KinematicsParams, type NozzleState, type WritingPlan } from './kinematics'
import type { PhysicsParams } from './params'
import { mulberry32 } from './rng'
import { ViscousThread, type Vec3 } from './thread'

const MM = 1e-3

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export interface SimulationStats {
  extruded: number
  deposited: number
  vStar: number
  flow: number
}

/** What the renderer needs from a simulation running elsewhere (a worker), per frame. */
export interface SimSnapshot {
  t: number
  steps: number
  nozzle: NozzleState
  tip: Vec3
  contact: Vec3
  stats: SimulationStats
  thread: { state: ViscousThread['state']; pos: Float32Array; radius: Float32Array }
  /** changed tiles and their cells (HeightField.readTiles layout) */
  tiles: Int32Array
  cells: Float32Array
}

export class PasteSimulation {
  readonly plan: WritingPlan
  readonly field: HeightField
  readonly thread = new ViscousThread(28)
  readonly kin: KinematicsParams
  readonly phys: PhysicsParams
  /** world metres of the name's centre offset (name is centred on the origin) */
  private readonly nameW: number
  private readonly nameH: number

  t = 0
  steps = 0
  nozzle: NozzleState
  /** world position of the nozzle tip (m) */
  readonly tip: Vec3 = { x: 0, y: 0, z: 0 }
  /** world position of the touchdown point (m) */
  readonly contact: Vec3 = { x: 0, y: 0, z: 0 }
  stats: SimulationStats = { extruded: 0, deposited: 0, vStar: 0, flow: 0 }

  private rng: () => number
  private stroke = -1
  /** mm — arc length of the touchdown point on the current stroke */
  private sContact = 0
  private coilPhase = 0
  /** m — total distance the touchdown point has travelled (keys paste passes) */
  private travel = 0
  private prevContact = { x: 0, z: 0 }
  private liftDrainDone = false
  private liftSpan0 = 0
  private pendingPeak: { x: number; z: number; volume: number; radius: number; sharp: number; laid: number } | null = null
  private lastSpeed = 0

  constructor(set: StrokeSet, kin: KinematicsParams, phys: PhysicsParams, startTime = -0.6) {
    this.kin = kin
    this.phys = phys
    this.plan = planWriting(set, kin)
    this.nameW = set.size[0] * MM
    this.nameH = set.size[1] * MM
    const m = phys.fieldMargin
    this.field = new HeightField(-this.nameW / 2 - m, -this.nameH / 2 - m, this.nameW + 2 * m, this.nameH + 2 * m, phys.cellSize)
    this.rng = mulberry32(phys.seed)
    this.t = startTime
    this.nozzle = sampleNozzle(this.plan, this.t, kin)
    this.updateTip()
  }

  get dt() {
    return 1 / this.phys.stepRate
  }
  /** s — the moment writing (and settling) is complete */
  get endTime() {
    return this.plan.tEnd + this.phys.settleTime + 0.2
  }
  /** fraction of the tube's paste used so far */
  get squeeze() {
    return Math.min(1, this.stats.extruded / this.phys.tubeVolume)
  }
  get extrudateRadius() {
    return this.phys.nozzleRadius * this.phys.dieSwell
  }

  /** mm name coordinates → world metres (x right, z toward the viewer). */
  toWorld(x: number, y: number): { x: number; z: number } {
    return { x: x * MM - this.nameW / 2, z: y * MM - this.nameH / 2 }
  }

  private pathPoint(si: number, s: number): { x: number; z: number } {
    const st = this.plan.strokes[si]
    const f = Math.min(st.x.length - 1, Math.max(0, (s / st.length) * (st.x.length - 1)))
    const i = Math.min(st.x.length - 2, Math.floor(f))
    const a = f - i
    return this.toWorld(st.x[i] + (st.x[i + 1] - st.x[i]) * a, st.y[i] + (st.y[i + 1] - st.y[i]) * a)
  }

  private areaAt(si: number, s: number): number {
    const st = this.plan.strokes[si]
    const f = Math.min(st.x.length - 1, Math.max(0, (s / st.length) * (st.x.length - 1)))
    const i = Math.min(st.x.length - 2, Math.floor(f))
    return (st.area[i] + (st.area[i + 1] - st.area[i]) * (f - i)) * MM * MM
  }

  private updateTip() {
    const w = this.toWorld(this.nozzle.x, this.nozzle.y)
    this.tip.x = w.x
    this.tip.z = w.z
    this.tip.y = this.nozzle.z * MM
  }

  /** Q₀: median writing flow (m³/s) */
  private get nominalFlow() {
    return this.plan.nominalArea * MM * MM * this.plan.medianSpeed * MM
  }

  step() {
    const dt = this.dt
    const p = this.phys
    this.t += dt
    this.steps++
    this.nozzle = sampleNozzle(this.plan, this.t, this.kin)
    this.updateTip()
    const nz = this.nozzle
    const rE = this.extrudateRadius
    const floor = (x: number, z: number) => this.field.sample(x, z)
    let flow = 0

    if (nz.phase === 'dwell' || nz.phase === 'draw') {
      const si = nz.stroke
      if (si !== this.stroke) this.beginStroke(si)
      const st = this.plan.strokes[si]
      const sNozzle = nz.phase === 'dwell' ? 0 : (nz.index / (st.x.length - 1)) * st.length
      const U = nz.phase === 'dwell' ? 0 : nz.speed * MM
      flow = nz.phase === 'dwell' ? p.dwellFlowRatio * this.nominalFlow : this.areaAt(si, sNozzle) * U
      const vE = flow / (Math.PI * rE * rE)
      const vStar = vE > 0 ? U / vE : 0
      this.stats.vStar = vStar
      this.lastSpeed = nz.speed

      // Dragged catenary: touchdown trails the nozzle by a fraction of the nozzle height.
      const lag = (p.contactLag * nz.z * smoothstep(0.6, 1.4, vStar)) // mm
      this.sContact = Math.min(st.length, Math.max(this.sContact, sNozzle - lag))
      // Rope coiling when the thread is fed faster than the paper "moves" under it.
      const coil = p.coilAmount * (1 - smoothstep(0.5 * p.coilOnset, p.coilOnset, vStar))
      const R = coil * p.coilRadius * rE
      if (R > 1e-5) this.coilPhase += (Math.max(vE, U) / R) * dt
      const base = this.pathPoint(si, this.sContact)
      const cx = base.x + R * Math.cos(this.coilPhase)
      const cz = base.z + R * Math.sin(this.coilPhase)
      // Following the path, the laid cross-section is A(s) itself (smooth, no step jitter);
      // while coiling, the volume is whatever the nozzle extrudes.
      const len = Math.hypot(cx - this.prevContact.x, cz - this.prevContact.z)
      this.travel += len
      // Following the path, the laid cross-section is A(s) (smooth); while coiling it is the
      // extrudate itself, since the thread is laid down at its own feed speed.
      const coiling = coil > 0.02 || nz.phase === 'dwell'
      const area = coiling ? Math.PI * rE * rE * 0.8 : this.areaAt(si, this.sContact)
      const dV = this.field.depositSweep(this.prevContact.x, this.prevContact.z, cx, cz, area, p.beadAspect, this.travel, this.t, p)
      this.stats.deposited += dV
      this.stats.extruded += dV
      this.prevContact.x = cx
      this.prevContact.z = cz
      this.setContact(cx, cz)

      // Thread: feed at the nozzle, take-up at the contact; viscous relaxation toward the span.
      const th = this.thread
      if (th.state !== 'attached') this.attachThread()
      const span = th.span()
      const takeUp = Math.hypot(U, 0)
      th.restLength += (vE - takeUp) * dt
      th.restLength += (span * 1.06 - th.restLength) * Math.min(1, 6 * dt)
      th.restLength = Math.min(span * 2.2, Math.max(span * 0.99, th.restLength))
      th.volume = Math.PI * rE * rE * nz.z * MM
      this.shapeAttached(vStar)
      th.solve(dt, this.tip, this.contact, p.gravity, 0.04, floor)
    } else if (nz.phase === 'lift' || (nz.phase === 'after' && this.thread.state !== 'none')) {
      this.stepLift(dt, floor, nz.phase === 'lift')
    } else {
      this.stats.vStar = 0
      if (this.thread.state === 'snapped') this.animateSnap(dt)
    }
    this.stats.flow = flow

    if (this.steps % p.relaxEvery === 0) this.field.relax(dt * p.relaxEvery, this.t, p)
  }

  private beginStroke(si: number) {
    this.layPeak(1)
    this.stroke = si
    this.sContact = 0
    this.liftDrainDone = false
    this.coilPhase = this.rng() * Math.PI * 2
    const s = this.pathPoint(si, 0)
    this.prevContact.x = s.x
    this.prevContact.z = s.z
  }

  private setContact(x: number, z: number) {
    this.contact.x = x
    this.contact.z = z
    this.contact.y = Math.max(0, this.field.sample(x, z) * 0.7)
  }

  private attachThread() {
    const th = this.thread
    th.state = 'attached'
    th.neck = 0
    th.reset(this.tip, this.contact)
    th.restLength = th.span() * 1.05
  }

  /** Radius profile of the attached thread: die swell at the nozzle, stretched middle, foot. */
  private shapeAttached(vStar: number) {
    const th = this.thread
    const rE = this.extrudateRadius
    const rMid = rE / Math.sqrt(Math.max(1, Math.min(3, vStar)))
    for (let i = 0; i < th.n; i++) {
      const u = i / (th.n - 1)
      const top = smoothstep(0.25, 0, u)
      const foot = smoothstep(0.7, 1, u)
      th.radius[i] = rMid + (rE - rMid) * top + (rE * 1.05 - rMid) * foot
    }
  }

  private stepLift(dt: number, floor: (x: number, z: number) => number, nextStroke = true) {
    const p = this.phys
    const th = this.thread
    const lift = this.plan.lifts[this.nozzle.stroke]
    const tau = lift ? (this.t - lift.t0) / (lift.t1 - lift.t0) : 1
    const si = this.stroke

    // 1) The thread keeps laying the stretch still in the air until the stroke end.
    if (!this.liftDrainDone && si >= 0) {
      const st = this.plan.strokes[si]
      const speed = Math.max(20, this.lastSpeed) // mm/s
      const s1 = Math.min(st.length, this.sContact + speed * dt)
      const a = this.pathPoint(si, s1)
      this.travel += Math.hypot(a.x - this.prevContact.x, a.z - this.prevContact.z)
      const dV = this.field.depositSweep(this.prevContact.x, this.prevContact.z, a.x, a.z, this.areaAt(si, s1), p.beadAspect, this.travel, this.t, p)
      if (dV > 0) {
        this.stats.deposited += dV
        this.stats.extruded += dV
      }
      this.sContact = s1
      this.prevContact.x = a.x
      this.prevContact.z = a.z
      this.setContact(a.x, a.z)
      if (s1 >= st.length - 1e-6) {
        this.liftDrainDone = true
        // Stretch is measured against the thread as it was while writing, not the rising nozzle.
        this.liftSpan0 = this.kin.nozzleHeight * MM * 1.05
        th.state = 'necking'
      }
    }

    // 2) Stretch, neck, snap.
    if (th.state === 'attached' || th.state === 'necking') {
      th.state = 'necking'
      const span = th.span()
      const stretch = span / Math.max(1e-6, this.liftSpan0 || span)
      th.restLength = span * 1.01
      const rE = this.extrudateRadius
      const rMean = rE / Math.sqrt(Math.max(1, stretch))
      th.neck = smoothstep(1.1, p.snapStretch, stretch)
      let rMin = Infinity
      for (let i = 0; i < th.n; i++) {
        const u = i / (th.n - 1)
        const g = Math.exp(-(((u - 0.45) / 0.2) ** 2))
        th.radius[i] = rMean * (1 - 0.9 * th.neck * g) * (0.85 + 0.3 * smoothstep(0.8, 1, u))
        rMin = Math.min(rMin, th.radius[i])
      }
      th.solve(dt, this.tip, this.contact, p.gravity, 0.05, floor)
      if (this.liftDrainDone && (rMin < p.snapRadius * rE || stretch >= p.snapStretch)) this.snap()
    } else if (th.state === 'snapped') {
      this.animateSnap(dt)
    }

    // 3) Near the end of the lift the next blob swells out of the nozzle.
    if (nextStroke && tau > 0.72 && (th.state === 'none' || th.state === 'drop')) {
      th.state = 'drop'
      const g = smoothstep(0.72, 1, tau)
      const rE = this.extrudateRadius
      for (let i = 0; i < th.n; i++) {
        const u = i / (th.n - 1)
        // The drop hangs from the nozzle but never below the paper or the paste already there.
        const room = Math.max(0, this.tip.y - floor(this.tip.x, this.tip.z) - rE * 0.4)
        th.pos.set([this.tip.x, this.tip.y - u * Math.min(rE * 2.2 * g, room), this.tip.z], i * 3)
        th.radius[i] = rE * g * (0.75 + 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.1)))
      }
    }
  }

  private snap() {
    const p = this.phys
    const th = this.thread
    const rE = this.extrudateRadius
    const airVolume = Math.PI * rE * rE * this.liftSpan0
    const halfWidth = Math.sqrt((4 * this.plan.nominalArea * MM * MM) / (Math.PI * p.beadAspect)) / 2
    // The fallen-back tail forms a peak about as tall as the bead again; its footprint follows
    // from the volume (dome ∝ (1 − d²/r²)^s has volume π r² h / (s + 1)), within sane limits.
    const sharp = 2.6
    const peakHeight = 0.9 * p.beadAspect * 2 * halfWidth
    let volume = p.tailPeakFraction * airVolume
    const r = Math.min(1.1 * halfWidth, Math.max(0.35 * halfWidth, Math.sqrt((volume * (sharp + 1)) / (Math.PI * peakHeight))))
    volume = Math.min(volume, (Math.PI * r * r * peakHeight) / (sharp + 1))
    this.pendingPeak = { x: this.contact.x, z: this.contact.z, volume, radius: Math.max(2 * p.cellSize, r), sharp, laid: 0 }
    th.state = 'snapped'
    th.sinceSnap = 0
    th.snapNode = Math.round(th.n * 0.55)
  }

  /** Lay the tail peak progressively while the lower stub collapses (no one-frame pop). */
  private layPeak(fraction: number) {
    const pk = this.pendingPeak
    if (!pk) return
    const target = Math.min(1, fraction)
    const dV = pk.volume * (target - pk.laid)
    if (dV > 0) {
      this.field.depositDome(pk.x, pk.z, dV, pk.radius, pk.sharp, this.t, this.phys)
      this.stats.deposited += dV
      this.stats.extruded += dV
      pk.laid = target
    }
    if (target >= 1) this.pendingPeak = null
  }

  /** After a snap: upper stub retracts into the nozzle, lower stub collapses into the peak. */
  private animateSnap(dt: number) {
    const th = this.thread
    th.sinceSnap += dt
    const k = Math.min(1, th.sinceSnap / 0.1)
    const e = 1 - (1 - k) * (1 - k)
    this.layPeak(e)
    for (let i = 0; i < th.n; i++) {
      const o = i * 3
      const target = i < th.snapNode ? this.tip : this.contact
      th.pos[o] += (target.x - th.pos[o]) * e * 0.35
      th.pos[o + 1] += (target.y - th.pos[o + 1]) * e * 0.35
      th.pos[o + 2] += (target.z - th.pos[o + 2]) * e * 0.35
      th.radius[i] *= 1 - 0.25 * e
    }
    if (k >= 1) {
      this.layPeak(1)
      th.state = 'none'
    }
  }

  /** Jump to the settled end state with a pre-baked field (already decoded into `field`). */
  finishFromBake() {
    this.t = this.endTime
    this.nozzle = sampleNozzle(this.plan, this.t, this.kin)
    this.updateTip()
    this.thread.state = 'none'
    this.stroke = -1
    this.stats.extruded = this.field.totalVolume()
    this.stats.deposited = this.stats.extruded
  }

  /** State for a mirror (see applySnapshot); takes the field's changed tiles since the last call. */
  snapshot(): SimSnapshot {
    const tiles = Int32Array.from(this.field.takeDirty(0))
    return {
      t: this.t,
      steps: this.steps,
      nozzle: { ...this.nozzle },
      tip: { ...this.tip },
      contact: { ...this.contact },
      stats: { ...this.stats },
      thread: { state: this.thread.state, pos: this.thread.pos.slice(), radius: this.thread.radius.slice() },
      tiles,
      cells: this.field.readTiles(tiles),
    }
  }

  /**
   * Mirror another instance's state for rendering. Only what the renderer reads is copied, so a
   * mirror must not be stepped itself afterwards (load a fresh simulation for that).
   */
  applySnapshot(s: SimSnapshot) {
    this.t = s.t
    this.steps = s.steps
    this.nozzle = s.nozzle
    Object.assign(this.tip, s.tip)
    Object.assign(this.contact, s.contact)
    this.stats = s.stats
    this.thread.state = s.thread.state
    this.thread.pos.set(s.thread.pos)
    this.thread.radius.set(s.thread.radius)
    if (s.tiles.length) this.field.writeTiles(s.tiles, s.cells)
  }

  /** Run until time t (s) without rendering. Deterministic. */
  advanceTo(t: number) {
    while (this.t + this.dt <= t) this.step()
  }
}
