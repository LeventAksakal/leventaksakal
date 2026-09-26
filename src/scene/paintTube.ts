/**
 * Procedural artist's paint tube: lathe-turned aluminium body with a printed label, shoulder,
 * threaded neck and open nozzle. The body flattens from the crimped end as paste leaves it
 * (`squeeze` = fraction of the tube's volume used), so what's on the paper visibly came out
 * of the tube. Local axis: nozzle tip at the origin, body along +Y. Units: metres.
 */
import * as THREE from 'three/webgpu'

const MM = 1e-3
const BODY_START = 27 * MM
const BODY_END = 118 * MM
const LENGTH = 126 * MM

function profile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [1.75, 5], // inside the bore
    [1.8, 0.6],
    [2.05, 0],
    [2.7, 0.05],
    [2.85, 0.6],
    [3.4, 8.5],
    [4.6, 9],
    [4.6, 9.6],
  ]
  // Threaded neck: small ridges.
  for (let y = 10; y < 17; y += 1.2) p.push([5.3, y], [5.75, y + 0.35], [5.75, y + 0.65], [5.3, y + 1.0])
  p.push([5.6, 17.4], [8.5, 19], [11.8, 21.8], [13.6, 24.5], [14.3, 27])
  for (let y = 30; y <= 118; y += 4) p.push([14.3, y])
  p.push([14.3, 119], [13.5, 121], [13.2, LENGTH / MM])
  return p.map(([r, y]) => new THREE.Vector2(r * MM, y * MM))
}

function labelCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 1024
  const g = c.getContext('2d')!
  // v runs along the tube (0 = nozzle); canvas y = v * height, flipped by the texture.
  g.fillStyle = '#b9bcbf'
  g.fillRect(0, 0, 1024, 1024)
  const y0 = (BODY_START / LENGTH) * 1024 + 30
  const y1 = (BODY_END / LENGTH) * 1024 - 40
  g.fillStyle = '#ece5d3'
  g.fillRect(0, y0, 1024, y1 - y0)
  g.fillStyle = '#f2a900'
  g.fillRect(0, y0 + (y1 - y0) * 0.14, 1024, (y1 - y0) * 0.38)
  g.fillStyle = '#1b1b1b'
  g.fillRect(0, y0 + (y1 - y0) * 0.55, 1024, 6)
  g.fillRect(0, y0 + (y1 - y0) * 0.57, 1024, 2)
  g.save()
  g.translate(512, y0 + (y1 - y0) * 0.75)
  g.fillStyle = '#1b1b1b'
  g.font = '600 44px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('CADMIUM YELLOW', 0, 0)
  g.font = '28px Georgia, serif'
  g.fillText('artists’ oil colour  ·  series 4  ·  37 ml', 0, 48)
  g.restore()
  return c
}

/** Roughness in G, metalness in B (three.js convention). */
function surfaceCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 1024
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(0, 80, 255)' // bare aluminium: fairly smooth metal
  g.fillRect(0, 0, 4, 1024)
  const y0 = (BODY_START / LENGTH) * 1024 + 30
  const y1 = (BODY_END / LENGTH) * 1024 - 40
  g.fillStyle = 'rgb(0, 120, 0)' // printed label: satin, non-metal
  g.fillRect(0, y0, 4, y1 - y0)
  return c
}

export class PaintTube {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.Mesh
  private readonly base: Float32Array
  private squeezeShown = -1
  /** current body axis (world), smoothed */
  private readonly axis = new THREE.Vector3(0.3, 1, -0.2).normalize()

  constructor() {
    const geo = new THREE.LatheGeometry(profile(), 48)
    // UV v along the axis in proportion to length (Lathe's v follows point index).
    const pos = geo.attributes.position as THREE.BufferAttribute
    const uvA = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) uvA.setY(i, 1 - pos.getY(i) / LENGTH)
    this.base = Float32Array.from(pos.array as Float32Array)
    const map = new THREE.CanvasTexture(labelCanvas())
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    const surf = new THREE.CanvasTexture(surfaceCanvas())
    const mat = new THREE.MeshPhysicalMaterial({
      map,
      roughnessMap: surf,
      metalnessMap: surf,
      roughness: 1,
      metalness: 1,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.castShadow = true
    this.group.add(this.mesh)
  }

  /** Flatten the body from the crimp end; squeeze ∈ [0, 1]. */
  setSqueeze(squeeze: number) {
    if (Math.abs(squeeze - this.squeezeShown) < 0.004) return
    this.squeezeShown = squeeze
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const front = 1 - Math.min(1, squeeze) * 0.95 // flattening front, in body fraction from the nozzle
    for (let i = 0; i < pos.count; i++) {
      const x = this.base[i * 3]
      const y = this.base[i * 3 + 1]
      const z = this.base[i * 3 + 2]
      let f = 0
      if (y > BODY_START) {
        const u = (y - BODY_START) / (BODY_END - BODY_START)
        f = smooth(front - 0.12, front + 0.1, u)
        if (y >= BODY_END) f = 1
        // Crimped end is always flat; creases where it rolls.
        f = Math.max(f, smooth(0.93, 1.0, u))
      }
      const crease = f > 0.05 ? 1 + 0.03 * Math.sin(y * 900) * f : 1
      arr[i * 3] = x * (1 + 0.5 * f) * crease
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z * (1 - 0.92 * f)
    }
    pos.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }

  /**
   * Place the nozzle tip at `tip` and lean the body away from the direction of travel,
   * following with a little spring lag (as if held just out of frame, upper right).
   */
  pose(tip: THREE.Vector3, travel: THREE.Vector2, speed: number, dt: number, tiltDeg = 20) {
    const tilt = THREE.MathUtils.degToRad(tiltDeg)
    const hold = new THREE.Vector3(0.45, 0, -0.55).normalize() // hand: up and to the right, away
    const lean = new THREE.Vector3(-travel.x, 0, -travel.y).multiplyScalar(Math.min(1, speed / 120)).add(hold.multiplyScalar(0.8))
    if (lean.lengthSq() < 1e-6) lean.set(0.5, 0, -0.5)
    lean.normalize()
    const target = new THREE.Vector3(0, 1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(lean, Math.sin(tilt)).normalize()
    this.axis.lerp(target, 1 - Math.exp(-dt * 6)).normalize()
    this.group.position.copy(tip)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.axis)
    // Turn the label toward the camera (roughly +Z).
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    this.group.quaternion.copy(q).multiply(spin)
  }
}

function smooth(e0: number, e1: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
