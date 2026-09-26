/**
 * Handwriting kinematics: turns centerline strokes into a timed nozzle trajectory.
 *
 * - Arc-length resampling at a fixed spacing.
 * - Speed from the two-thirds power law (Lacquaniti, Terzuolo & Viviani 1983):
 *   angular velocity ∝ curvature^(2/3)  ⇔  tangential speed U = k · κ^(−1/3) = k · R^(1/3).
 *   Clamped at both ends, smoothed along the path, eased in at stroke starts and out before lifts.
 * - Pen lifts get a travel-dependent time budget; k is solved so the whole drawing phase
 *   hits a target duration.
 * - Deposition law (brief §2.2): A(s) = Q(s) / U(s) with Q = Q₀ (U/U₀)^φ, so
 *   A ∝ U^(φ−1): slow curves lay down a fatter bead.
 *
 * Pure functions, no rendering, no clock: the same input always gives the same plan.
 */
import type { StrokeSet } from '../lettering/types'

export interface KinematicsParams {
  /** mm — arc-length spacing of the resampled path */
  sampleSpacing: number
  /** mm — Gaussian σ applied to curvature κ(s) before the power law */
  curvatureSmoothing: number
  /** — exponent β in U ∝ R^β; 1/3 is the two-thirds power law */
  powerLawBeta: number
  /** mm — radius-of-curvature clamp (cusps and retraces hit this) */
  radiusMin: number
  /** mm — radius-of-curvature clamp (straights hit this) */
  radiusMax: number
  /** mm — Gaussian σ applied to the speed profile */
  speedSmoothing: number
  /** mm — length of the speed ramp at a stroke start */
  easeInLength: number
  /** mm — length of the speed ramp before a pen lift */
  easeOutLength: number
  /** — fraction of local speed at the very first / last sample of a stroke */
  easeFloor: number
  /** s — first touchdown to final lift-off, including the start dwell and all pen lifts */
  drawDuration: number
  /** s — nozzle held still at first touchdown so the paste piles into a coil */
  startDwell: number
  /** s — shortest pen lift (tube rises, travels, lowers) */
  liftMin: number
  /** s — longest pen lift */
  liftMax: number
  /** mm — travel distance at which a lift takes liftMax */
  liftDistanceForMax: number
  /** mm — nozzle tip height above the paper while writing (≈ 1–3 bead diameters) */
  nozzleHeight: number
  /** mm — nozzle tip height at the top of a pen lift */
  liftHeight: number
  /** — φ in Q = Q₀ (U/U₀)^φ: how much the hand squeezes less when it slows down */
  flowExponent: number
  /** mm — nominal bead width at the median writing speed */
  beadWidth: number
  /** — clamp for A/A₀ (thin end) */
  areaRatioMin: number
  /** — clamp for A/A₀ (fat end) */
  areaRatioMax: number
}

export const defaultKinematics: KinematicsParams = {
  sampleSpacing: 0.5,
  curvatureSmoothing: 1.5,
  powerLawBeta: 1 / 3,
  radiusMin: 1.5,
  radiusMax: 120,
  speedSmoothing: 3,
  easeInLength: 10,
  easeOutLength: 6,
  easeFloor: 0.2,
  drawDuration: 11.1,
  startDwell: 0.6,
  liftMin: 0.3,
  liftMax: 0.5,
  liftDistanceForMax: 150,
  nozzleHeight: 6,
  liftHeight: 30,
  flowExponent: 0.3,
  beadWidth: 5,
  areaRatioMin: 0.55,
  areaRatioMax: 1.9,
}

export interface StrokePlan {
  id: string
  delayed: boolean
  /** mm */
  x: Float64Array
  y: Float64Array
  /** mm, arc length from stroke start */
  s: Float64Array
  /** 1/mm, smoothed unsigned curvature */
  kappa: Float64Array
  /** mm/s, nozzle speed */
  U: Float64Array
  /** s, absolute time at each sample */
  t: Float64Array
  /** mm², deposited cross-section A = Q/U */
  area: Float64Array
  length: number
}

export interface LiftPlan {
  /** index of the stroke that just ended */
  after: number
  t0: number
  t1: number
  from: [number, number]
  to: [number, number]
  distance: number
}

export interface WritingPlan {
  strokes: StrokePlan[]
  lifts: LiftPlan[]
  /** s — first touchdown (start of the dwell) */
  tStart: number
  /** s — final lift-off */
  tEnd: number
  /** mm/s — median writing speed U₀ */
  medianSpeed: number
  /** mm² — nominal bead cross-section A₀ at U₀ */
  nominalArea: number
  /** mm/s — the power-law gain k after fitting to drawDuration */
  gain: number
  totalLength: number
}

export type NozzlePhase = 'before' | 'dwell' | 'draw' | 'lift' | 'after'

export interface NozzleState {
  phase: NozzlePhase
  x: number
  y: number
  /** mm above the paper */
  z: number
  /** mm/s, horizontal speed */
  speed: number
  /** unit travel direction on the paper */
  dirX: number
  dirY: number
  stroke: number
  /** fractional sample index into the current stroke */
  index: number
}

function resample(points: [number, number][], ds: number): { x: Float64Array; y: Float64Array; length: number } {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay))
  }
  const length = cum[cum.length - 1]
  const n = Math.max(2, Math.round(length / ds) + 1)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    const s = (length * i) / (n - 1)
    while (j < cum.length - 2 && cum[j + 1] < s) j++
    const seg = cum[j + 1] - cum[j] || 1
    const f = Math.min(1, Math.max(0, (s - cum[j]) / seg))
    x[i] = points[j][0] + (points[j + 1][0] - points[j][0]) * f
    y[i] = points[j][1] + (points[j + 1][1] - points[j][1]) * f
  }
  return { x, y, length }
}

/** Gaussian smoothing with clamped ends; sigma in samples. */
export function gaussianSmooth(v: Float64Array, sigma: number): Float64Array {
  if (sigma < 0.5) return v.slice()
  const r = Math.ceil(sigma * 3)
  const w: number[] = []
  for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)))
  const out = new Float64Array(v.length)
  for (let i = 0; i < v.length; i++) {
    let acc = 0
    let norm = 0
    for (let k = -r; k <= r; k++) {
      const j = Math.min(v.length - 1, Math.max(0, i + k))
      acc += v[j] * w[k + r]
      norm += w[k + r]
    }
    out[i] = acc / norm
  }
  return out
}

function curvature(x: Float64Array, y: Float64Array, ds: number): Float64Array {
  const n = x.length
  const k = new Float64Array(n)
  for (let i = 1; i < n - 1; i++) {
    const ax = x[i] - x[i - 1]
    const ay = y[i] - y[i - 1]
    const bx = x[i + 1] - x[i]
    const by = y[i + 1] - y[i]
    const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
    k[i] = Math.abs(turn) / ds
  }
  k[0] = k[1] ?? 0
  k[n - 1] = k[n - 2] ?? 0
  return k
}

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

function median(values: number[]): number {
  const a = values.slice().sort((p, q) => p - q)
  return a[Math.floor(a.length / 2)]
}

export function planWriting(set: StrokeSet, p: KinematicsParams): WritingPlan {
  const ds = p.sampleSpacing
  const shaped = set.strokes.map((def) => {
    const { x, y, length } = resample(def.points, ds)
    const s = new Float64Array(x.length).map((_, i) => i * (length / (x.length - 1)))
    const kappa = gaussianSmooth(curvature(x, y, ds), p.curvatureSmoothing / ds)
    // Two-thirds power law: U ∝ R^β with R = 1/κ clamped.
    const raw = new Float64Array(x.length)
    for (let i = 0; i < x.length; i++) {
      const R = Math.min(p.radiusMax, Math.max(p.radiusMin, 1 / Math.max(kappa[i], 1e-9)))
      raw[i] = Math.pow(R, p.powerLawBeta)
    }
    const U = gaussianSmooth(raw, p.speedSmoothing / ds)
    for (let i = 0; i < x.length; i++) {
      const ease = smoothstep(0, p.easeInLength, s[i]) * smoothstep(0, p.easeOutLength, length - s[i])
      U[i] *= p.easeFloor + (1 - p.easeFloor) * ease
    }
    return { def, x, y, s, kappa, U, length }
  })

  // Pen lifts: travel-dependent budget.
  const lifts: Omit<LiftPlan, 't0' | 't1'>[] = []
  for (let i = 0; i < shaped.length - 1; i++) {
    const a = shaped[i]
    const b = shaped[i + 1]
    const from: [number, number] = [a.x[a.x.length - 1], a.y[a.y.length - 1]]
    const to: [number, number] = [b.x[0], b.y[0]]
    lifts.push({ after: i, from, to, distance: Math.hypot(to[0] - from[0], to[1] - from[1]) })
  }
  const liftTime = (d: number) => p.liftMin + (p.liftMax - p.liftMin) * Math.min(1, d / p.liftDistanceForMax)
  const liftTotal = lifts.reduce((acc, l) => acc + liftTime(l.distance), 0)

  // Solve the gain k so that Σ ∫ds/U + lifts + dwell = drawDuration.
  let rawTime = 0
  for (const st of shaped) for (let i = 1; i < st.U.length; i++) rawTime += ds / (0.5 * (st.U[i] + st.U[i - 1]))
  const available = Math.max(0.5, p.drawDuration - p.startDwell - liftTotal)
  const gain = rawTime / available

  let t = p.startDwell
  const strokes: StrokePlan[] = []
  const liftPlans: LiftPlan[] = []
  const allU: number[] = []
  shaped.forEach((st, si) => {
    const U = st.U.map((u) => u * gain)
    const times = new Float64Array(U.length)
    times[0] = t
    for (let i = 1; i < U.length; i++) times[i] = times[i - 1] + (st.s[i] - st.s[i - 1]) / (0.5 * (U[i] + U[i - 1]))
    t = times[times.length - 1]
    for (const u of U) allU.push(u)
    strokes.push({
      id: st.def.id,
      delayed: st.def.delayed,
      x: st.x,
      y: st.y,
      s: st.s,
      kappa: st.kappa,
      U,
      t: times,
      area: new Float64Array(U.length),
      length: st.length,
    })
    if (si < lifts.length) {
      const l = lifts[si]
      const d = liftTime(l.distance)
      liftPlans.push({ ...l, t0: t, t1: t + d })
      t += d
    }
  })

  const U0 = median(allU)
  const A0 = (Math.PI * p.beadWidth * p.beadWidth) / 8 // half-disc of diameter beadWidth
  for (const st of strokes) {
    for (let i = 0; i < st.U.length; i++) {
      const ratio = Math.pow(st.U[i] / U0, p.flowExponent - 1)
      st.area[i] = A0 * Math.min(p.areaRatioMax, Math.max(p.areaRatioMin, ratio))
    }
  }

  return {
    strokes,
    lifts: liftPlans,
    tStart: 0,
    tEnd: t,
    medianSpeed: U0,
    nominalArea: A0,
    gain,
    totalLength: strokes.reduce((a, s) => a + s.length, 0),
  }
}

function upperBound(arr: Float64Array, v: number): number {
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (arr[mid] <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Nozzle position at time t (seconds from first touchdown). */
export function sampleNozzle(plan: WritingPlan, t: number, p: KinematicsParams): NozzleState {
  const first = plan.strokes[0]
  const last = plan.strokes[plan.strokes.length - 1]
  if (t < first.t[0]) {
    return {
      phase: t < 0 ? 'before' : 'dwell',
      x: first.x[0],
      y: first.y[0],
      z: p.nozzleHeight,
      speed: 0,
      ...dirAt(first, 0),
      stroke: 0,
      index: 0,
    }
  }
  for (let si = 0; si < plan.strokes.length; si++) {
    const st = plan.strokes[si]
    const tEnd = st.t[st.t.length - 1]
    if (t <= tEnd) {
      const i = upperBound(st.t, t)
      const j = Math.min(i + 1, st.t.length - 1)
      const f = j === i ? 0 : (t - st.t[i]) / (st.t[j] - st.t[i])
      return {
        phase: 'draw',
        x: st.x[i] + (st.x[j] - st.x[i]) * f,
        y: st.y[i] + (st.y[j] - st.y[i]) * f,
        z: p.nozzleHeight,
        speed: st.U[i] + (st.U[j] - st.U[i]) * f,
        ...dirAt(st, i),
        stroke: si,
        index: i + f,
      }
    }
    const lift = plan.lifts[si]
    if (lift && t < lift.t1) {
      const tau = (t - lift.t0) / (lift.t1 - lift.t0)
      const m = smootherstep(tau)
      const dx = lift.to[0] - lift.from[0]
      const dy = lift.to[1] - lift.from[1]
      const dur = lift.t1 - lift.t0
      const dm = (30 * tau * tau * (tau - 1) * (tau - 1)) / dur
      const len = Math.hypot(dx, dy) || 1
      return {
        phase: 'lift',
        x: lift.from[0] + dx * m,
        y: lift.from[1] + dy * m,
        z: p.nozzleHeight + (p.liftHeight - p.nozzleHeight) * Math.pow(Math.sin(Math.PI * tau), 0.7),
        speed: len * dm,
        dirX: dx / len,
        dirY: dy / len,
        stroke: si,
        index: st.x.length - 1,
      }
    }
  }
  return {
    phase: 'after',
    x: last.x[last.x.length - 1],
    y: last.y[last.y.length - 1],
    z: p.liftHeight,
    speed: 0,
    ...dirAt(last, last.x.length - 1),
    stroke: plan.strokes.length - 1,
    index: last.x.length - 1,
  }
}

function dirAt(st: StrokePlan, i: number): { dirX: number; dirY: number } {
  const a = Math.max(0, Math.min(i, st.x.length - 2))
  const dx = st.x[a + 1] - st.x[a]
  const dy = st.y[a + 1] - st.y[a]
  const n = Math.hypot(dx, dy) || 1
  return { dirX: dx / n, dirY: dy / n }
}
