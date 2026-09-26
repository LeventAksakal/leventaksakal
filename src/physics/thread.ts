/**
 * The short airborne paste thread between the nozzle and the paper, as a viscous rod.
 *
 * Reduced from Discrete Viscous Threads (Bergou et al. 2010) to what reads on screen:
 * a Lagrangian chain integrated with XPBD (Macklin, Müller & Chentanez 2016). The rod's
 * rest length is not elastic memory but a viscous state: extrusion feeds length in at the
 * nozzle, touchdown takes it out at the contact, and the rest length relaxes toward the
 * current span at a rate set by the viscosity (so the thread behaves like honey, not rubber).
 * Volume is conserved: radius follows from the airborne volume and the rest length.
 *
 * The thread doesn't decide where paste lands (the contact model in simulation.ts does);
 * it gives the falling paste its shape, sag, swing, necking and snap.
 */

export type ThreadState = 'none' | 'drop' | 'attached' | 'necking' | 'snapped'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export class ViscousThread {
  readonly n: number
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly radius: Float32Array
  state: ThreadState = 'none'
  /** m — current rest length of the whole rod */
  restLength = 0
  /** m³ — paste currently in the air */
  volume = 0
  /** 0..1 — neck depth while a lifting thread thins */
  neck = 0
  /** s — time since the snap (for the retraction animation) */
  sinceSnap = 0
  /** node index where the thread broke */
  snapNode = 0

  constructor(n = 28) {
    this.n = n
    this.pos = new Float32Array(n * 3)
    this.prev = new Float32Array(n * 3)
    this.radius = new Float32Array(n)
  }

  /** Straight initialisation between two points. */
  reset(a: Vec3, b: Vec3) {
    for (let i = 0; i < this.n; i++) {
      const u = i / (this.n - 1)
      const x = a.x + (b.x - a.x) * u
      const y = a.y + (b.y - a.y) * u
      const z = a.z + (b.z - a.z) * u
      this.pos.set([x, y, z], i * 3)
      this.prev.set([x, y, z], i * 3)
    }
  }

  /**
   * One XPBD step with both ends pinned.
   * @param floor height of paper+paste under a point, for collisions
   */
  solve(dt: number, tip: Vec3, contact: Vec3, gravity: number, damping: number, floor: (x: number, z: number) => number) {
    const { n, pos, prev } = this
    const seg = this.restLength / (n - 1)
    for (let i = 1; i < n - 1; i++) {
      const o = i * 3
      const vx = (pos[o] - prev[o]) * (1 - damping)
      const vy = (pos[o + 1] - prev[o + 1]) * (1 - damping)
      const vz = (pos[o + 2] - prev[o + 2]) * (1 - damping)
      prev[o] = pos[o]
      prev[o + 1] = pos[o + 1]
      prev[o + 2] = pos[o + 2]
      pos[o] += vx
      pos[o + 1] += vy - gravity * dt * dt
      pos[o + 2] += vz
    }
    const pin = () => {
      pos[0] = tip.x
      pos[1] = tip.y
      pos[2] = tip.z
      const o = (n - 1) * 3
      pos[o] = contact.x
      pos[o + 1] = contact.y
      pos[o + 2] = contact.z
    }
    pin()
    for (let it = 0; it < 10; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3
        const b = a + 3
        const dx = pos[b] - pos[a]
        const dy = pos[b + 1] - pos[a + 1]
        const dz = pos[b + 2] - pos[a + 2]
        const d = Math.hypot(dx, dy, dz) || 1e-9
        const c = (d - seg) / d
        // inverse masses: pinned ends are immovable
        const wa = i === 0 ? 0 : 1
        const wb = i + 1 === n - 1 ? 0 : 1
        const w = wa + wb
        if (w === 0) continue
        pos[a] += (wa / w) * c * dx
        pos[a + 1] += (wa / w) * c * dy
        pos[a + 2] += (wa / w) * c * dz
        pos[b] -= (wb / w) * c * dx
        pos[b + 1] -= (wb / w) * c * dy
        pos[b + 2] -= (wb / w) * c * dz
      }
      for (let i = 1; i < n - 1; i++) {
        const o = i * 3
        const fl = floor(pos[o], pos[o + 2]) + this.radius[i] * 0.8
        if (pos[o + 1] < fl) pos[o + 1] = fl
      }
      pin()
    }
  }

  /** Span between the ends (m). */
  span(): number {
    const o = (this.n - 1) * 3
    return Math.hypot(this.pos[o] - this.pos[0], this.pos[o + 1] - this.pos[1], this.pos[o + 2] - this.pos[2])
  }
}
