/**
 * Renders the height field as displaced meshes with a wet, glossy paint material.
 *
 * The field is cut into chunks along x; each chunk owns a HalfFloat texture (height in mm,
 * plus the bead direction) and a grid mesh displaced in the vertex stage. Only chunks that
 * changed are re-uploaded. Normals are rebuilt per pixel from the texture (central
 * differences) plus analytic detail: nozzle striations along the bead and sparse air pits.
 */
import * as THREE from 'three/webgpu'
import {
  Fn,
  atan,
  cos,
  float,
  fwidth,
  max,
  mix,
  mx_noise_float,
  mx_worley_noise_float,
  normalize,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import type { HeightField } from '../physics/heightfield'
import { toHalf } from './half'

// TSL's TypeScript types are narrower than its runtime; shader glue uses a loose node type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const CHUNK = 128 // cells per chunk along x
const PIT_TILE_MM = 14 // world size of one tile of the pit map
const PIT_RES = 512
const APRON = 2 // extra cells on each side for normals and filtering
const VERT_STEP = 2 // cells per vertex

export interface PasteLook {
  base: THREE.Color
  highlightTint: THREE.Color
  shadowTint: THREE.Color
}

export class PasteSurface {
  readonly group = new THREE.Group()
  readonly uniforms = {
    striation: uniform(0.6),
    pits: uniform(1.0),
    roughness: uniform(0.5),
    clearcoat: uniform(1),
    clearcoatRoughness: uniform(0.08),
    base: uniform(new THREE.Color('#eea000')),
    shadowTint: uniform(new THREE.Color('#d0780a')),
    highlightTint: uniform(new THREE.Color('#ffe08a')),
  }
  /** reflection strength of the gloss environment */
  gloss = 1
  /** Coarse (1 mm) blurred height used by the paper for contact occlusion. */
  readonly occlusion: THREE.DataTexture
  private readonly chunks: { tex: THREE.DataTexture; i0: number; i1: number; data: Uint16Array; mesh: THREE.Mesh }[] = []
  private readonly pitMap: THREE.Texture | null
  private readonly field: HeightField
  private readonly occData: Uint16Array
  private readonly occF: Float32Array
  private readonly occTmp: Float32Array
  private occDirty = true
  private readonly occFactor = 4
  readonly occW: number
  readonly occH: number

  private readonly glossEnv: THREE.Texture | null

  constructor(field: HeightField, pitMap: THREE.Texture | null = null, glossEnv: THREE.Texture | null = null) {
    this.field = field
    this.pitMap = pitMap
    this.glossEnv = glossEnv
    const f = field
    const texH = f.nz
    const dx = f.dx

    for (let i0 = 0; i0 < f.nx; i0 += CHUNK) {
      const i1 = Math.min(f.nx, i0 + CHUNK)
      const texW = i1 - i0 + 2 * APRON
      const data = new Uint16Array(texW * texH * 4)
      const tex = new THREE.DataTexture(data, texW, texH, THREE.RGBAFormat, THREE.HalfFloatType)
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearFilter
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
      const texX0 = f.x0 + (i0 - APRON) * dx
      const geo = gridGeometry(f.x0 + i0 * dx, f.z0, (i1 - i0) * dx, f.nz * dx, Math.ceil((i1 - i0) / VERT_STEP), Math.ceil(f.nz / VERT_STEP), texX0, texW * dx, f.nz * dx)
      const mat = this.makeMaterial(tex, texW, texH, dx)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = false
      mesh.frustumCulled = false
      mesh.visible = false // shown once it holds paste
      this.group.add(mesh)
      this.chunks.push({ tex, i0, i1, data, mesh })
    }

    this.occW = Math.ceil(f.nx / this.occFactor)
    this.occH = Math.ceil(f.nz / this.occFactor)
    this.occF = new Float32Array(this.occW * this.occH)
    this.occTmp = new Float32Array(this.occW * this.occH)
    this.occData = new Uint16Array(this.occW * this.occH * 4)
    this.occlusion = new THREE.DataTexture(this.occData, this.occW, this.occH, THREE.RGBAFormat, THREE.HalfFloatType)
    this.occlusion.magFilter = this.occlusion.minFilter = THREE.LinearFilter
    this.occlusion.needsUpdate = true
  }

  private makeMaterial(tex: THREE.DataTexture, texW: number, texH: number, dx: number) {
    const u = this.uniforms
    const mat = new THREE.MeshPhysicalNodeMaterial()
    const texel = vec2(1 / texW, 1 / texH)
    const hAt = (o: N) => texture(tex, uv().add(o)).r
    const hMm = hAt(vec2(0, 0))

    mat.positionNode = Fn(() => {
      const h = texture(tex, uv()).r
      return positionLocal.add(vec3(0, max(h, 0).mul(0.001).add(0.00002), 0))
    })()

    // Fade out over bare paper; with alpha-to-coverage the MSAA samples give a smooth edge,
    // and the paste never z-fights the ground.
    mat.opacityNode = smoothstep(0.015, 0.07, hMm)
    mat.alphaToCoverage = true
    mat.alphaTest = 0.01

    const normalWorld = Fn(() => {
      const hl = hAt(vec2(texel.x.negate(), 0))
      const hr = hAt(vec2(texel.x, 0))
      const hd = hAt(vec2(0, texel.y.negate()))
      const hu = hAt(vec2(0, texel.y))
      // mm per metre → slope (both in mm): dh/dx = (hr − hl) / (2 dx_mm)
      const gx = hr.sub(hl).div(2 * dx * 1000).toVar()
      const gz = hu.sub(hd).div(2 * dx * 1000).toVar()

      const p = positionWorld.xz.mul(1000) // mm
      const t = texture(tex, uv())
      const thick = smoothstep(0.25, 1.2, t.r)
      // Nozzle striations: fine grooves running along the bead (doubled-angle direction).
      const theta = atan(t.b, t.g).mul(0.5)
      const along = vec2(cos(theta), sin(theta))
      const across = vec2(along.y.negate(), along.x)
      const phase = p.dot(across).div(0.42).add(mx_noise_float(p.mul(0.35)).mul(1.5))
      const fade = float(1).sub(smoothstep(0.25, 0.9, fwidth(phase)))
      const amp = u.striation.mul(0.09).mul(thick).mul(fade).mul(mx_noise_float(p.mul(0.6)).mul(0.5).add(0.6))
      const s = cos(phase.mul(6.2831853)).mul(amp)
      gx.addAssign(across.x.mul(s))
      gz.addAssign(across.y.mul(s))
      // Sparse air-bubble pits from the baked tileable pit map (depth in R).
      if (this.pitMap) {
        const puv = p.div(PIT_TILE_MM)
        const e = 2 / PIT_RES
        const c0 = texture(this.pitMap, puv).r
        const cx = texture(this.pitMap, puv.add(vec2(e, 0))).r.sub(c0).div(e * PIT_TILE_MM)
        const cz = texture(this.pitMap, puv.add(vec2(0, e))).r.sub(c0).div(e * PIT_TILE_MM)
        const depth = u.pits.mul(thick).mul(0.12)
        gx.addAssign(cx.mul(depth).negate())
        gz.addAssign(cz.mul(depth).negate())
      }
      return normalize(vec3(gx.negate(), 1, gz.negate()))
    })

    const nView = transformNormalToView(normalWorld())
    mat.normalNode = nView
    // The clearcoat has its own normal input; without this it mirrors the flat grid.
    mat.clearcoatNormalNode = nView

    // Colour: thin edges read slightly translucent and deeper; thick paste is pure cadmium.
    mat.colorNode = Fn(() => {
      const h = hMm
      const body = mix(u.shadowTint, u.base, smoothstep(0.03, 0.35, h))
      return body
    })()
    mat.roughnessNode = u.roughness
    mat.metalnessNode = float(0)
    mat.clearcoatNode = u.clearcoat
    mat.clearcoatRoughnessNode = u.clearcoatRoughness
    mat.specularColorNode = u.highlightTint
    mat.specularIntensityNode = float(0.3)
    mat.emissiveNode = u.shadowTint.mul(smoothstep(0.4, 0.05, hMm).mul(0.015))
    if (this.glossEnv) {
      mat.envMap = this.glossEnv
      mat.envMapIntensity = 1
    }
    return mat
  }

  /** Upload chunks touched since the last call. Returns whether anything changed. */
  update(): boolean {
    const rect = this.field.takeDirty()
    if (!rect) return false
    const f = this.field
    for (const c of this.chunks) {
      if (rect.i1 <= c.i0 - APRON || rect.i0 >= c.i1 + APRON) continue
      const texW = c.i1 - c.i0 + 2 * APRON
      const k0 = Math.max(0, rect.k0 - 1)
      const k1 = Math.min(f.nz, rect.k1 + 1)
      let any = false
      for (let k = k0; k < k1; k++) {
        for (let x = 0; x < texW; x++) {
          const i = Math.min(f.nx - 1, Math.max(0, c.i0 - APRON + x))
          const id = k * f.nx + i
          const h = f.h[id]
          const o = (k * texW + x) * 4
          c.data[o] = toHalf(h * 1000)
          const inv = h > 1e-7 ? 1 / h : 0
          c.data[o + 1] = toHalf(f.dirC[id] * inv)
          c.data[o + 2] = toHalf(f.dirS[id] * inv)
          if (h > 2e-5) any = true
        }
      }
      if (any) c.mesh.visible = true
      c.tex.needsUpdate = true
    }
    this.occDirty = true
    return true
  }

  setGloss(v: number) {
    this.gloss = v
    for (const c of this.chunks) (c.mesh.material as THREE.MeshPhysicalNodeMaterial).envMapIntensity = v
  }

  dispose() {
    for (const c of this.chunks) {
      c.tex.dispose()
      c.mesh.geometry.dispose()
      ;(c.mesh.material as THREE.Material).dispose()
    }
    this.occlusion.dispose()
  }

  /** Rebuild the coarse occlusion texture (cheap; call at a few Hz). */
  updateOcclusion(force = false) {
    if (!this.occDirty && !force) return
    this.occDirty = false
    const f = this.field
    const F = this.occFactor
    const W = this.occW
    const H = this.occH
    const a = this.occF
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let k = y * F; k < Math.min(f.nz, y * F + F); k++)
          for (let i = x * F; i < Math.min(f.nx, x * F + F); i++) s += f.h[k * f.nx + i]
        a[y * W + x] = (s / (F * F)) * 1000
      }
    // Separable blur (radius 4 coarse cells ≈ 4 mm) so the shadow bleeds past the bead edge.
    const R = 4
    const b = this.occTmp
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0
        let n = 0
        for (let d = -R; d <= R; d++) {
          const xx = x + d
          if (xx < 0 || xx >= W) continue
          s += a[y * W + xx]
          n++
        }
        b[y * W + x] = s / n
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0
        let n = 0
        for (let d = -R; d <= R; d++) {
          const yy = y + d
          if (yy < 0 || yy >= H) continue
          s += b[yy * W + x]
          n++
        }
        this.occData[(y * W + x) * 4] = toHalf((s / n) * 2.2)
      }
    this.occlusion.needsUpdate = true
  }
}

/**
 * Tileable air-pit map: sparse small round dimples (Worley cells picked by noise), cross-faded
 * so it wraps seamlessly. Baked once; R = pit depth 0..1.
 */
export function bakePits(renderer: THREE.WebGPURenderer): THREE.RenderTarget {
  const rt = new THREE.RenderTarget(PIT_RES, PIT_RES, { type: THREE.HalfFloatType, depthBuffer: false })
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping
  rt.texture.magFilter = rt.texture.minFilter = THREE.LinearFilter
  const T = PIT_TILE_MM
  const pit = (q: N): N => {
    const cell = mx_worley_noise_float(q.mul(0.55))
    const pick = smoothstep(0.58, 0.64, mx_noise_float(q.mul(0.21).add(vec2(3.1, 7.7))))
    return smoothstep(0.17, 0.0, cell).mul(pick)
  }
  const colour = Fn(() => {
    const q = uv().mul(T)
    const w = uv()
    const a = pit(q).mul(float(1).sub(w.x)).mul(float(1).sub(w.y))
    const b = pit(q.sub(vec2(T, 0))).mul(w.x).mul(float(1).sub(w.y))
    const c = pit(q.sub(vec2(0, T))).mul(float(1).sub(w.x)).mul(w.y)
    const d = pit(q.sub(vec2(T, T))).mul(w.x).mul(w.y)
    return vec3(a.add(b).add(c).add(d), 0, 0)
  })
  const bakeMat = new THREE.MeshBasicNodeMaterial({ colorNode: colour() })
  const quad = new THREE.QuadMesh(bakeMat)
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt)
  quad.render(renderer)
  renderer.setRenderTarget(prev)
  bakeMat.dispose()
  return rt
}

/** Grid in the XZ plane (normal +Y) with UVs mapped into a texture rect. */
function gridGeometry(x0: number, z0: number, w: number, d: number, sx: number, sz: number, texX0: number, texW: number, texD: number) {
  const pos = new Float32Array((sx + 1) * (sz + 1) * 3)
  const uvs = new Float32Array((sx + 1) * (sz + 1) * 2)
  let o = 0
  let q = 0
  for (let k = 0; k <= sz; k++)
    for (let i = 0; i <= sx; i++) {
      const x = x0 + (w * i) / sx
      const z = z0 + (d * k) / sz
      pos[o++] = x
      pos[o++] = 0
      pos[o++] = z
      uvs[q++] = (x - texX0) / texW
      uvs[q++] = (z - z0) / texD
    }
  const idx: number[] = []
  for (let k = 0; k < sz; k++)
    for (let i = 0; i < sx; i++) {
      const a = k * (sx + 1) + i
      const b = a + 1
      const c = a + sx + 1
      const e = c + 1
      idx.push(a, c, b, b, c, e)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((sx + 1) * (sz + 1) * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(idx)
  return g
}
