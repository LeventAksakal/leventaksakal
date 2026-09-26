/** Tube mesh for the airborne paste thread, rebuilt every frame from the XPBD chain. */
import * as THREE from 'three/webgpu'
import type { ViscousThread } from '../physics/thread'

const SIDES = 14

export class ThreadMesh {
  readonly mesh: THREE.Mesh
  private readonly geo: THREE.BufferGeometry
  private readonly pos: Float32Array
  private readonly nrm: Float32Array
  private readonly rings: number

  constructor(nodes: number, material: THREE.Material) {
    this.rings = nodes + 2 // plus a collapsed cap ring at each end
    const verts = this.rings * SIDES
    this.pos = new Float32Array(verts * 3)
    this.nrm = new Float32Array(verts * 3)
    const idx: number[] = []
    for (let r = 0; r < this.rings - 1; r++)
      for (let s = 0; s < SIDES; s++) {
        const a = r * SIDES + s
        const b = r * SIDES + ((s + 1) % SIDES)
        const c = a + SIDES
        const d = b + SIDES
        idx.push(a, b, c, b, d, c) // outward-facing: rings run counter-clockwise around the tangent
      }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setIndex(idx)
    this.mesh = new THREE.Mesh(this.geo, material)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
  }

  update(th: ViscousThread) {
    const visible = th.state !== 'none'
    this.mesh.visible = visible
    if (!visible) return
    const n = th.n
    const P = th.pos
    const tangent = new THREE.Vector3()
    const ref = new THREE.Vector3(0, 0, 1)
    const nA = new THREE.Vector3()
    const nB = new THREE.Vector3()
    const put = (ring: number, cx: number, cy: number, cz: number, r: number, t: THREE.Vector3) => {
      // Stable frame: project a reference vector off the tangent.
      nA.copy(Math.abs(t.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : ref).addScaledVector(t, -(Math.abs(t.z) > 0.9 ? t.x : t.z)).normalize()
      nB.crossVectors(t, nA).normalize()
      for (let s = 0; s < SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const nx = nA.x * ca + nB.x * sa
        const ny = nA.y * ca + nB.y * sa
        const nz = nA.z * ca + nB.z * sa
        const o = (ring * SIDES + s) * 3
        this.pos[o] = cx + nx * r
        this.pos[o + 1] = cy + ny * r
        this.pos[o + 2] = cz + nz * r
        this.nrm[o] = nx
        this.nrm[o + 1] = ny
        this.nrm[o + 2] = nz
      }
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1)
      const b = Math.min(n - 1, i + 1)
      tangent.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2])
      if (tangent.lengthSq() < 1e-14) tangent.set(0, -1, 0)
      tangent.normalize()
      put(i + 1, P[i * 3], P[i * 3 + 1], P[i * 3 + 2], Math.max(0, th.radius[i]), tangent)
      if (i === 0) put(0, P[0] - tangent.x * th.radius[0] * 0.3, P[1] - tangent.y * th.radius[0] * 0.3, P[2] - tangent.z * th.radius[0] * 0.3, 0, tangent)
      if (i === n - 1) {
        const o = i * 3
        put(n + 1, P[o] + tangent.x * th.radius[i] * 0.6, P[o + 1] + tangent.y * th.radius[i] * 0.6, P[o + 2] + tangent.z * th.radius[i] * 0.6, 0, tangent)
      }
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.normal.needsUpdate = true
  }
}
