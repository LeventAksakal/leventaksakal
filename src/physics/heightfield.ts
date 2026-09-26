/**
 * Everything that has landed on the paper, as a height field h(x, z) over the name's region.
 *
 * It changes through deposition (volume-exact stamps along the touchdown path) and slow
 * viscoplastic spreading (shallow-layer Bingham flux). Only recently wetted tiles are updated:
 * behind the nozzle the yield stress locks the paste, so most of the field is static.
 *
 * Cells store height (m) plus an axis-like bead direction (doubled-angle vector, so a retrace
 * doesn't cancel it) for the striation normal detail.
 */
import type { PhysicsParams } from './params'
import { binghamFluxCoefficient, plasticViscosity } from './rheology'

const TILE = 16

export interface FieldRect {
  i0: number
  i1: number
  k0: number
  k1: number
}

export class HeightField {
  readonly nx: number
  readonly nz: number
  readonly dx: number
  /** world x/z of the corner of cell (0, 0) */
  readonly x0: number
  readonly z0: number
  readonly h: Float32Array
  /** Σ Δh · cos 2θ and Σ Δh · sin 2θ of the laying direction θ */
  readonly dirC: Float32Array
  readonly dirS: Float32Array
  /** height laid by the current pass (for max-compositing) and the contact travel when it was */
  private readonly pass: Float32Array
  private readonly passTravel: Float32Array

  private readonly ntx: number
  private readonly ntz: number
  private readonly wetUntil: Float32Array
  private readonly roundUntil: Float32Array
  private readonly update: Uint8Array
  private readonly fx: Float32Array
  private readonly fz: Float32Array
  private readonly dirty: FieldRect = { i0: Infinity, i1: -Infinity, k0: Infinity, k1: -Infinity }
  private readonly tileList: number[] = []
  private scratchIdx = new Int32Array(4096)
  private scratchW = new Float32Array(4096)

  constructor(x0: number, z0: number, width: number, depth: number, dx: number) {
    this.dx = dx
    this.x0 = x0
    this.z0 = z0
    this.nx = Math.ceil(width / dx)
    this.nz = Math.ceil(depth / dx)
    const n = this.nx * this.nz
    this.h = new Float32Array(n)
    this.dirC = new Float32Array(n)
    this.dirS = new Float32Array(n)
    this.pass = new Float32Array(n)
    this.passTravel = new Float32Array(n)
    this.fx = new Float32Array(n)
    this.fz = new Float32Array(n)
    this.ntx = Math.ceil(this.nx / TILE)
    this.ntz = Math.ceil(this.nz / TILE)
    this.wetUntil = new Float32Array(this.ntx * this.ntz).fill(-1)
    this.roundUntil = new Float32Array(this.ntx * this.ntz).fill(-1)
    this.update = new Uint8Array(this.ntx * this.ntz)
  }

  clear() {
    this.h.fill(0)
    this.dirC.fill(0)
    this.dirS.fill(0)
    this.pass.fill(0)
    this.passTravel.fill(0)
    this.wetUntil.fill(-1)
    this.roundUntil.fill(-1)
    this.markDirty(0, this.nx, 0, this.nz)
  }

  /** Bilinear height (m) at world x, z. */
  sample(x: number, z: number): number {
    const fx = (x - this.x0) / this.dx - 0.5
    const fz = (z - this.z0) / this.dx - 0.5
    const i = Math.floor(fx)
    const k = Math.floor(fz)
    if (i < 0 || k < 0 || i >= this.nx - 1 || k >= this.nz - 1) return 0
    const a = fx - i
    const b = fz - k
    const n = this.nx
    const h = this.h
    return (
      (h[k * n + i] * (1 - a) + h[k * n + i + 1] * a) * (1 - b) +
      (h[(k + 1) * n + i] * (1 - a) + h[(k + 1) * n + i + 1] * a) * b
    )
  }

  totalVolume(): number {
    let v = 0
    for (let i = 0; i < this.h.length; i++) v += this.h[i]
    return v * this.dx * this.dx
  }

  /** Dirty cell rectangle since the last call (for texture uploads), or null. */
  takeDirty(): FieldRect | null {
    const d = this.dirty
    if (d.i1 < d.i0) return null
    const r = { i0: Math.max(0, d.i0), i1: Math.min(this.nx, d.i1), k0: Math.max(0, d.k0), k1: Math.min(this.nz, d.k1) }
    d.i0 = d.k0 = Infinity
    d.i1 = d.k1 = -Infinity
    return r
  }

  private markDirty(i0: number, i1: number, k0: number, k1: number) {
    const d = this.dirty
    d.i0 = Math.min(d.i0, i0)
    d.i1 = Math.max(d.i1, i1)
    d.k0 = Math.min(d.k0, k0)
    d.k1 = Math.max(d.k1, k1)
  }

  private wet(i0: number, i1: number, k0: number, k1: number, now: number, p: PhysicsParams) {
    const t0 = Math.max(0, Math.floor(i0 / TILE))
    const t1 = Math.min(this.ntx - 1, Math.floor((i1 - 1) / TILE))
    const s0 = Math.max(0, Math.floor(k0 / TILE))
    const s1 = Math.min(this.ntz - 1, Math.floor((k1 - 1) / TILE))
    for (let s = s0; s <= s1; s++)
      for (let t = t0; t <= t1; t++) {
        const id = s * this.ntx + t
        this.wetUntil[id] = Math.max(this.wetUntil[id], now + p.settleTime)
        this.roundUntil[id] = Math.max(this.roundUntil[id], now + p.edgeRoundingTime)
      }
    this.markDirty(i0, i1, k0, k1)
  }

  private ensureScratch(n: number) {
    if (this.scratchIdx.length >= n) return
    this.scratchIdx = new Int32Array(n * 2)
    this.scratchW = new Float32Array(n * 2)
  }

  /**
   * Lay fresh paste along the touchdown segment a→b with cross-section `area` (m²).
   * The cross-section is a rounded half-ellipse of aspect `aspect` (height/width), swept as a
   * capsule and max-composited within the current pass, so curves come out as a smooth tube.
   * A cell last covered more than `commit` metres of contact travel ago counts as an earlier
   * pass: the new bead then sits on top of it (retraces, crossings, coils pile up).
   * Returns the volume actually added (m³).
   */
  depositSweep(ax: number, az: number, bx: number, bz: number, area: number, aspect: number, travel: number, now: number, p: PhysicsParams): number {
    if (area <= 0) return 0
    const width = Math.sqrt((4 * area) / (Math.PI * aspect))
    const half = width / 2
    const h0 = aspect * width
    const commit = 1.6 * width
    const dx = this.dx
    const pad = half + dx
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - this.x0) / dx))
    const i1 = Math.min(this.nx, Math.ceil((Math.max(ax, bx) + pad - this.x0) / dx))
    const k0 = Math.max(0, Math.floor((Math.min(az, bz) - pad - this.z0) / dx))
    const k1 = Math.min(this.nz, Math.ceil((Math.max(az, bz) + pad - this.z0) / dx))
    if (i1 <= i0 || k1 <= k0) return 0
    const sx = bx - ax
    const sz = bz - az
    const len2 = sx * sx + sz * sz
    const len = Math.sqrt(len2)
    const c2 = len > 0 ? (sx * sx - sz * sz) / len2 : 1 // cos 2θ
    const s2 = len > 0 ? (2 * sx * sz) / len2 : 0 // sin 2θ
    let added = 0
    for (let k = k0; k < k1; k++) {
      const pz = this.z0 + (k + 0.5) * dx - az
      for (let i = i0; i < i1; i++) {
        const px = this.x0 + (i + 0.5) * dx - ax
        const t = len2 > 0 ? Math.min(1, Math.max(0, (px * sx + pz * sz) / len2)) : 0
        const ex = px - t * sx
        const ez = pz - t * sz
        const q = 1 - (ex * ex + ez * ez) / (half * half)
        if (q <= 0) continue
        const v = h0 * Math.sqrt(q)
        const id = k * this.nx + i
        let pass = this.pass[id]
        if (pass > 0 && travel - this.passTravel[id] > commit) pass = 0 // earlier pass: build on top
        this.passTravel[id] = travel
        if (v <= pass) continue
        const dh = v - pass
        this.pass[id] = v
        this.h[id] += dh
        this.dirC[id] += dh * c2
        this.dirS[id] += dh * s2
        added += dh
      }
    }
    this.wet(i0, i1, k0, k1, now, p)
    return added * dx * dx
  }

  /** Volume dV as a radially symmetric dome: h ∝ (1 − (d/r)²)^sharpness (sharp > 1 → peaked). */
  depositDome(x: number, z: number, dV: number, radius: number, sharpness: number, now: number, p: PhysicsParams) {
    if (dV <= 0) return
    const dx = this.dx
    const pad = radius + dx
    const i0 = Math.max(0, Math.floor((x - pad - this.x0) / dx))
    const i1 = Math.min(this.nx, Math.ceil((x + pad - this.x0) / dx))
    const k0 = Math.max(0, Math.floor((z - pad - this.z0) / dx))
    const k1 = Math.min(this.nz, Math.ceil((z + pad - this.z0) / dx))
    if (i1 <= i0 || k1 <= k0) return
    this.ensureScratch((i1 - i0) * (k1 - k0))
    let n = 0
    let sum = 0
    for (let k = k0; k < k1; k++)
      for (let i = i0; i < i1; i++) {
        const cx = this.x0 + (i + 0.5) * dx - x
        const cz = this.z0 + (k + 0.5) * dx - z
        const q = 1 - (cx * cx + cz * cz) / (radius * radius)
        if (q <= 0) continue
        const w = Math.pow(q, sharpness)
        this.scratchIdx[n] = k * this.nx + i
        this.scratchW[n] = w
        sum += w
        n++
      }
    if (sum <= 0) {
      const i = Math.floor((x - this.x0) / dx)
      const k = Math.floor((z - this.z0) / dx)
      if (i >= 0 && k >= 0 && i < this.nx && k < this.nz) this.h[k * this.nx + i] += dV / (dx * dx)
    } else {
      const scale = dV / (sum * dx * dx)
      for (let j = 0; j < n; j++) this.h[this.scratchIdx[j]] += this.scratchW[j] * scale
    }
    this.wet(i0, i1, k0, k1, now, p)
  }

  /** True while any tile is still settling. */
  isSettling(now: number): boolean {
    for (let i = 0; i < this.wetUntil.length; i++) if (this.wetUntil[i] > now) return true
    return false
  }

  /**
   * Viscoplastic relaxation of wet tiles over dt:
   *   ∂h/∂t + ∇·q = 0,  q = −(c_Bingham + D_round) ∇h
   * Explicit, conservative, with a positivity limiter and CFL substepping.
   */
  relax(dt: number, now: number, p: PhysicsParams) {
    const { nx, nz, ntx, ntz, dx, h, fx, fz, update } = this
    // Update set = wet tiles plus a one-tile ring (which may receive paste but not give any).
    update.fill(0)
    const tiles = this.tileList
    tiles.length = 0
    for (let s = 0; s < ntz; s++)
      for (let t = 0; t < ntx; t++) {
        if (this.wetUntil[s * ntx + t] <= now) continue
        for (let ds = -1; ds <= 1; ds++)
          for (let dt2 = -1; dt2 <= 1; dt2++) {
            const ss = s + ds
            const tt = t + dt2
            if (ss < 0 || tt < 0 || ss >= ntz || tt >= ntx) continue
            const id = ss * ntx + tt
            if (!update[id]) {
              update[id] = 1
              tiles.push(id)
            }
          }
      }
    if (tiles.length === 0) return

    const rg = p.density * p.gravity
    const mu = plasticViscosity(p)
    const tileOf = (i: number, k: number) => ((k / TILE) | 0) * ntx + ((i / TILE) | 0)

    let remaining = dt
    for (let pass = 0; pass < p.maxRelaxSubsteps && remaining > 1e-9; pass++) {
      let dmax = 0
      for (const tid of tiles) {
        const round = this.roundUntil[tid] > now ? p.edgeRounding : 0
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        const rightOk = ti + TILE < nx && update[tid + 1] === 1
        const downOk = tk + TILE < nz && update[tid + ntx] === 1
        for (let k = tk; k < kEnd; k++) {
          const up = k > 0 ? k - 1 : k
          const dn = k < nz - 1 ? k + 1 : k
          for (let i = ti; i < iEnd; i++) {
            const id = k * nx + i
            const hc = h[id]
            let f = 0
            if (i + 1 < iEnd || (i + 1 === iEnd && rightOk)) {
              const hr = h[id + 1]
              if (hc > 0 || hr > 0) {
                const gx = (hr - hc) / dx
                const gz = (h[dn * nx + i] + h[dn * nx + i + 1] - h[up * nx + i] - h[up * nx + i + 1]) / (2 * (dn - up) * dx)
                const c = binghamFluxCoefficient(hc > hr ? hc : hr, Math.hypot(gx, gz), rg, p.yieldStress, mu) + (hc > 0 && hr > 0 ? round : 0.35 * round)
                f = -c * gx
                if (c > dmax) dmax = c
              }
            }
            fx[id] = f
            f = 0
            if (k + 1 < kEnd || (k + 1 === kEnd && downOk)) {
              const hd = h[id + nx]
              if (hc > 0 || hd > 0) {
                const gz = (hd - hc) / dx
                const l = i > 0 ? i - 1 : i
                const r = i < nx - 1 ? i + 1 : i
                const gx = (h[k * nx + r] + h[(k + 1) * nx + r] - h[k * nx + l] - h[(k + 1) * nx + l]) / (2 * (r - l) * dx)
                const c = binghamFluxCoefficient(hc > hd ? hc : hd, Math.hypot(gx, gz), rg, p.yieldStress, mu) + (hc > 0 && hd > 0 ? round : 0.35 * round)
                f = -c * gz
                if (c > dmax) dmax = c
              }
            }
            fz[id] = f
          }
        }
      }
      if (dmax <= 0) break
      // CFL-limited substep. When the budget runs out the remaining time is dropped, which
      // locally slows the flow (like a higher viscosity) instead of going unstable.
      const sub = Math.min(remaining, (0.2 * dx * dx) / dmax)
      remaining -= sub
      const lim = (0.2 * dx) / sub
      const a = sub / dx
      for (const tid of tiles) {
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        for (let k = tk; k < kEnd; k++)
          for (let i = ti; i < iEnd; i++) {
            const id = k * nx + i
            let f = fx[id]
            if (f > 0) fx[id] = Math.min(f, h[id] * lim)
            else if (f < 0) fx[id] = Math.max(f, -h[id + 1] * lim)
            f = fz[id]
            if (f > 0) fz[id] = Math.min(f, h[id] * lim)
            else if (f < 0) fz[id] = Math.max(f, -h[id + nx] * lim)
          }
      }
      for (const tid of tiles) {
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        for (let k = tk; k < kEnd; k++)
          for (let i = ti; i < iEnd; i++) {
            const id = k * nx + i
            // Faces owned by a neighbour tile outside the update set carry no flux.
            const inX = i > 0 && update[tileOf(i - 1, k)] === 1 ? fx[id - 1] : 0
            const inZ = k > 0 && update[tileOf(i, k - 1)] === 1 ? fz[id - nx] : 0
            const v = h[id] - a * (fx[id] - inX + fz[id] - inZ)
            h[id] = v > 0 ? v : 0
          }
        this.markDirty(ti, iEnd, tk, kEnd)
      }
    }
  }
}
