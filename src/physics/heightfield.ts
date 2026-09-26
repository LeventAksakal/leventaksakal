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
import { plasticViscosity } from './rheology'

/** cells per tile side: the unit of wetting, relaxation and change tracking */
export const TILE = 16

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
  private readonly tileFlags: Uint8Array
  /**
   * Exact skipping of locked tiles: a tile whose faces all carried zero flux when last
   * evaluated, with nothing changed in it or its eight neighbours since, would compute zero
   * again. `gen` counts events; `changed` / `quietAt` hold the gen of a tile's last height
   * change / last all-zero evaluation (−1 = not quiet) and `quietFlags` its neighbour flags then.
   */
  private gen = 0
  private readonly changed: Float64Array
  private readonly quietAt: Float64Array
  private readonly quietFlags: Uint8Array
  private readonly fx: Float32Array
  private readonly fz: Float32Array
  /** Tiles changed since the last take, one set per consumer (texture upload, occlusion). */
  private readonly dirty: [Uint8Array, Uint8Array]
  private readonly dirtyList: [number[], number[]] = [[], []]
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
    this.dirty = [new Uint8Array(this.ntx * this.ntz), new Uint8Array(this.ntx * this.ntz)]
    this.tileFlags = new Uint8Array(this.ntx * this.ntz)
    this.changed = new Float64Array(this.ntx * this.ntz)
    this.quietAt = new Float64Array(this.ntx * this.ntz).fill(-1)
    this.quietFlags = new Uint8Array(this.ntx * this.ntz)
  }

  clear() {
    this.h.fill(0)
    this.dirC.fill(0)
    this.dirS.fill(0)
    this.pass.fill(0)
    this.passTravel.fill(0)
    this.wetUntil.fill(-1)
    this.roundUntil.fill(-1)
    this.changed.fill(++this.gen)
    this.markDirty(0, this.nx, 0, this.nz)
  }

  /** Mark the whole field changed (after loading a bake). */
  touchAll() {
    this.changed.fill(++this.gen)
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

  /** Tiles per row / column (tile id = row · tilesX + column). */
  get tilesX() {
    return this.ntx
  }
  get tilesZ() {
    return this.ntz
  }

  /** Ids of tiles changed since this consumer's last call (0 = surface upload, 1 = occlusion). */
  takeDirty(consumer: 0 | 1): number[] {
    const list = this.dirtyList[consumer]
    const out = list.slice()
    const flags = this.dirty[consumer]
    for (const id of list) flags[id] = 0
    list.length = 0
    return out
  }

  /**
   * Copy tiles out as [h, cos2θ-sum, sin2θ-sum] per cell, TILE² cells per tile in row order
   * (cells past the field edge are zero). Used to mirror a worker's field on the main thread.
   */
  readTiles(ids: ArrayLike<number>): Float32Array {
    const out = new Float32Array(ids.length * TILE * TILE * 3)
    let o = 0
    for (let n = 0; n < ids.length; n++) {
      const t = ids[n] % this.ntx
      const s = (ids[n] / this.ntx) | 0
      for (let k = s * TILE; k < s * TILE + TILE; k++)
        for (let i = t * TILE; i < t * TILE + TILE; i++, o += 3) {
          if (i >= this.nx || k >= this.nz) continue
          const id = k * this.nx + i
          out[o] = this.h[id]
          out[o + 1] = this.dirC[id]
          out[o + 2] = this.dirS[id]
        }
    }
    return out
  }

  /** Write tiles produced by readTiles() and mark them changed. */
  writeTiles(ids: ArrayLike<number>, cells: Float32Array) {
    let o = 0
    for (let n = 0; n < ids.length; n++) {
      const t = ids[n] % this.ntx
      const s = (ids[n] / this.ntx) | 0
      for (let k = s * TILE; k < s * TILE + TILE; k++)
        for (let i = t * TILE; i < t * TILE + TILE; i++, o += 3) {
          if (i >= this.nx || k >= this.nz) continue
          const id = k * this.nx + i
          this.h[id] = cells[o]
          this.dirC[id] = cells[o + 1]
          this.dirS[id] = cells[o + 2]
        }
      this.markTile(ids[n])
    }
  }

  private markDirty(i0: number, i1: number, k0: number, k1: number) {
    const t0 = Math.max(0, (i0 / TILE) | 0)
    const t1 = Math.min(this.ntx - 1, ((i1 - 1) / TILE) | 0)
    const s0 = Math.max(0, (k0 / TILE) | 0)
    const s1 = Math.min(this.ntz - 1, ((k1 - 1) / TILE) | 0)
    for (let s = s0; s <= s1; s++)
      for (let t = t0; t <= t1; t++) this.markTile(s * this.ntx + t)
  }

  private markTile(id: number) {
    for (let c = 0; c < 2; c++)
      if (!this.dirty[c][id]) {
        this.dirty[c][id] = 1
        this.dirtyList[c].push(id)
      }
  }

  private wet(i0: number, i1: number, k0: number, k1: number, now: number, p: PhysicsParams) {
    const t0 = Math.max(0, Math.floor(i0 / TILE))
    const t1 = Math.min(this.ntx - 1, Math.floor((i1 - 1) / TILE))
    const s0 = Math.max(0, Math.floor(k0 / TILE))
    const s1 = Math.min(this.ntz - 1, Math.floor((k1 - 1) / TILE))
    const g = ++this.gen
    for (let s = s0; s <= s1; s++)
      for (let t = t0; t <= t1; t++) {
        const id = s * this.ntx + t
        this.changed[id] = g
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

  /** A tile left all-zero at its last evaluation, with no height change in its 3×3 block since. */
  private isQuiet(tid: number, ti: number, tk: number): boolean {
    const q = this.quietAt[tid]
    if (q < 0 || this.quietFlags[tid] !== this.tileFlags[tid]) return false
    const ntx = this.ntx
    const t = (ti / TILE) | 0
    const s = (tk / TILE) | 0
    for (let ds = -1; ds <= 1; ds++) {
      const ss = s + ds
      if (ss < 0 || ss >= this.ntz) continue
      for (let dt = -1; dt <= 1; dt++) {
        const tt = t + dt
        if (tt < 0 || tt >= ntx) continue
        if (this.changed[ss * ntx + tt] >= q) return false
      }
    }
    return true
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
    // Bingham coefficient c = ρg·Y²(3h − Y)/(6μ) with Y = h − τ_y/(ρg|∇h|): the layer is locked
    // (c = 0) unless |∇h| > τ_y/(ρg·h). Most wet paste is locked, so testing that on |∇h|² first
    // skips the square root for most cells.
    const lock = p.yieldStress / rg
    const cK = rg / (6 * plasticViscosity(p))
    // Per-tile neighbour flags, fixed for this call: bit 0 right tile updates, bit 1 lower tile
    // updates, bit 2 left tile updates, bit 3 upper tile updates.
    const flags = this.tileFlags
    for (const tid of tiles) {
      const ti = (tid % ntx) * TILE
      const tk = ((tid / ntx) | 0) * TILE
      flags[tid] =
        (ti + TILE < nx && update[tid + 1] === 1 ? 1 : 0) |
        (tk + TILE < nz && update[tid + ntx] === 1 ? 2 : 0) |
        (ti > 0 && update[tid - 1] === 1 ? 4 : 0) |
        (tk > 0 && update[tid - ntx] === 1 ? 8 : 0)
    }

    let remaining = dt
    for (let pass = 0; pass < p.maxRelaxSubsteps && remaining > 1e-9; pass++) {
      let dmax = 0
      const g = ++this.gen
      for (const tid of tiles) {
        const round = this.roundUntil[tid] > now ? p.edgeRounding : 0
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        if (round === 0 && this.isQuiet(tid, ti, tk)) continue
        let anyFlux = false
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        // Faces on the tile's right/lower edge carry flux only if that neighbour updates too.
        const iLast = flags[tid] & 1 ? iEnd : iEnd - 1
        const kLast = flags[tid] & 2 ? kEnd : kEnd - 1
        for (let k = tk; k < kEnd; k++) {
          const up = k > 0 ? k - 1 : k
          const dn = k < nz - 1 ? k + 1 : k
          const row = k * nx
          const rowUp = up * nx
          const rowDn = dn * nx
          const zSpan = 2 * (dn - up) * dx
          for (let i = ti; i < iEnd; i++) {
            const id = row + i
            const hc = h[id]
            let f = 0
            if (i < iLast) {
              const hr = h[id + 1]
              if (hc > 0 || hr > 0) {
                const gx = (hr - hc) / dx
                const gz = (h[rowDn + i] + h[rowDn + i + 1] - h[rowUp + i] - h[rowUp + i + 1]) / zSpan
                const hm = hc > hr ? hc : hr
                const s2 = gx * gx + gz * gz
                const t = lock / hm
                let c = hc > 0 && hr > 0 ? round : 0.35 * round
                if (s2 > t * t) {
                  const Y = hm - lock / Math.sqrt(s2)
                  if (Y > 0) c += cK * Y * Y * (3 * hm - Y)
                }
                f = -c * gx
                if (c > 0) anyFlux = true
                if (c > dmax) dmax = c
              }
            }
            fx[id] = f
            f = 0
            if (k < kLast) {
              const hd = h[id + nx]
              if (hc > 0 || hd > 0) {
                const gz = (hd - hc) / dx
                const l = i > 0 ? i - 1 : i
                const r = i < nx - 1 ? i + 1 : i
                const gx = (h[row + r] + h[row + nx + r] - h[row + l] - h[row + nx + l]) / (2 * (r - l) * dx)
                const hm = hc > hd ? hc : hd
                const s2 = gx * gx + gz * gz
                const t = lock / hm
                let c = hc > 0 && hd > 0 ? round : 0.35 * round
                if (s2 > t * t) {
                  const Y = hm - lock / Math.sqrt(s2)
                  if (Y > 0) c += cK * Y * Y * (3 * hm - Y)
                }
                f = -c * gz
                if (c > 0) anyFlux = true
                if (c > dmax) dmax = c
              }
            }
            fz[id] = f
          }
        }
        if (!anyFlux && round === 0) {
          this.quietAt[tid] = g
          this.quietFlags[tid] = flags[tid]
        } else this.quietAt[tid] = -1
      }
      if (dmax <= 0) break
      // CFL-limited substep. When the budget runs out the remaining time is dropped, which
      // locally slows the flow (like a higher viscosity) instead of going unstable.
      const sub = Math.min(remaining, (0.2 * dx * dx) / dmax)
      remaining -= sub
      const lim = (0.2 * dx) / sub
      const a = sub / dx
      // Positivity limiter: a face never drains more than its upwind cell holds.
      for (const tid of tiles) {
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        for (let k = tk; k < kEnd; k++)
          for (let id = k * nx + ti, e = k * nx + iEnd; id < e; id++) {
            const gx = fx[id]
            if (gx > 0) {
              const m = h[id] * lim
              if (gx > m) fx[id] = m
            } else if (gx < 0) {
              const m = -h[id + 1] * lim
              if (gx < m) fx[id] = m
            }
            const gz = fz[id]
            if (gz > 0) {
              const m = h[id] * lim
              if (gz > m) fz[id] = m
            } else if (gz < 0) {
              const m = -h[id + nx] * lim
              if (gz < m) fz[id] = m
            }
          }
      }
      for (const tid of tiles) {
        const ti = (tid % ntx) * TILE
        const tk = ((tid / ntx) | 0) * TILE
        const iEnd = Math.min(nx, ti + TILE)
        const kEnd = Math.min(nz, tk + TILE)
        // Faces owned by a neighbour tile outside the update set carry no flux.
        const leftIn = (flags[tid] & 4) !== 0
        const upIn = (flags[tid] & 8) !== 0
        let changed = false
        for (let k = tk; k < kEnd; k++) {
          const zIn = k > tk || upIn
          for (let i = ti; i < iEnd; i++) {
            const id = k * nx + i
            const inX = i > ti || leftIn ? fx[id - 1] : 0
            const inZ = zIn ? fz[id - nx] : 0
            const div = fx[id] - inX + fz[id] - inZ
            if (div === 0) continue
            const v = h[id] - a * div
            h[id] = v > 0 ? v : 0
            changed = true
          }
        }
        if (changed) {
          this.changed[tid] = g
          this.markTile(tid)
        }
      }
    }
  }
}
