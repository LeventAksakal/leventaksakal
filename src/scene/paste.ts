/**
 * Renders the height field as displaced meshes with a wet, glossy paint material.
 *
 * The field is cut into chunks along x. All chunks share one material and one HalfFloat array
 * texture (a layer per chunk: height in mm plus the bead direction), so the shader graph is
 * built once, and only layers whose tiles changed are re-uploaded. Each chunk is a grid mesh
 * displaced in the vertex stage, hidden until it holds paste. Normals are rebuilt per pixel
 * from the texture (central differences) plus detail from one baked map: nozzle striations
 * along the bead and sparse air pits.
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
  sqrt,
  texture,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import { TILE, type HeightField } from '../physics/heightfield'
import { toHalf } from './half'

// TSL's TypeScript types are narrower than its runtime; shader glue uses a loose node type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const CHUNK = 128 // cells per chunk along x (a multiple of TILE)
const DETAIL_TILE_MM = 14 // world size of one tile of the detail map
const DETAIL_RES = 512
const APRON = 2 // extra cells on each side for normals and filtering
const VERT_STEP = 2 // cells per vertex
const OCC = 4 // fine cells per coarse occlusion cell (TILE / OCC coarse cells per tile)
const OCC_R = 4 // occlusion blur radius in coarse cells (≤ TILE / OCC, so one tile of reach)
const PASTE_MIN_HALF = toHalf(0.02) // 2e-5 m in mm, as float16 bits (monotonic for positives)

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
  readonly occW: number
  readonly occH: number

  private readonly field: HeightField
  private readonly tex: THREE.DataArrayTexture
  private readonly data: Uint16Array
  private readonly texW: number
  private readonly layerSize: number
  private readonly meshes: THREE.Mesh[] = []
  private readonly material: THREE.MeshPhysicalNodeMaterial
  private readonly occData: Uint16Array
  /** coarse cell means (mm), then the horizontal blur pass */
  private readonly occA: Float32Array
  private readonly occB: Float32Array

  constructor(field: HeightField, detailMap: THREE.Texture | null = null, glossEnv: THREE.Texture | null = null) {
    this.field = field
    const f = field
    const texH = f.nz
    const dx = f.dx
    const layers = Math.ceil(f.nx / CHUNK)
    this.texW = CHUNK + 2 * APRON
    this.layerSize = this.texW * texH * 4
    this.data = new Uint16Array(this.layerSize * layers)
    this.tex = new THREE.DataArrayTexture(this.data, this.texW, texH, layers)
    this.tex.format = THREE.RGBAFormat
    this.tex.type = THREE.HalfFloatType
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping
    this.tex.needsUpdate = true
    this.material = this.makeMaterial(texH, dx, detailMap, glossEnv)

    for (let layer = 0; layer < layers; layer++) {
      const i0 = layer * CHUNK
      const i1 = Math.min(f.nx, i0 + CHUNK)
      const texX0 = f.x0 + (i0 - APRON) * dx
      const geo = gridGeometry(f.x0 + i0 * dx, f.z0, (i1 - i0) * dx, f.nz * dx, Math.ceil((i1 - i0) / VERT_STEP), Math.ceil(f.nz / VERT_STEP), texX0, this.texW * dx, f.nz * dx)
      const mesh = new THREE.Mesh(geo, this.material)
      mesh.userData.layer = layer
      mesh.castShadow = true
      mesh.receiveShadow = false
      mesh.frustumCulled = false
      mesh.matrixAutoUpdate = false
      mesh.visible = false // shown once it holds paste
      this.group.add(mesh)
      this.meshes.push(mesh)
    }

    this.occW = Math.ceil(f.nx / OCC)
    this.occH = Math.ceil(f.nz / OCC)
    this.occA = new Float32Array(this.occW * this.occH)
    this.occB = new Float32Array(this.occW * this.occH)
    this.occData = new Uint16Array(this.occW * this.occH * 4)
    this.occlusion = new THREE.DataTexture(this.occData, this.occW, this.occH, THREE.RGBAFormat, THREE.HalfFloatType)
    this.occlusion.magFilter = this.occlusion.minFilter = THREE.LinearFilter
    this.occlusion.needsUpdate = true
  }

  /** Every chunk mesh visible, e.g. to compile or warm up before paste arrives. */
  showAll(on: boolean) {
    if (on) for (const m of this.meshes) m.visible = true
    else for (const m of this.meshes) m.visible = this.hasPaste(m.userData.layer)
  }

  private hasPaste(layer: number) {
    const d = this.data
    for (let o = layer * this.layerSize, e = o + this.layerSize; o < e; o += 4) if (d[o] > PASTE_MIN_HALF) return true
    return false
  }

  private makeMaterial(texH: number, dx: number, detailMap: THREE.Texture | null, glossEnv: THREE.Texture | null) {
    const u = this.uniforms
    const tex = this.tex
    const mat = new THREE.MeshPhysicalNodeMaterial()
    const layer = uniform(0, 'int').onObjectUpdate(({ object }) => (object?.userData.layer as number) ?? 0)
    const texel = vec2(1 / this.texW, 1 / texH)
    const at = (o: N) => texture(tex, uv().add(o)).depth(layer)
    const hMm = at(vec2(0, 0)).r

    mat.positionNode = Fn(() => {
      const h = texture(tex, uv()).depth(layer).r
      return positionLocal.add(vec3(0, max(h, 0).mul(0.001).add(0.00002), 0))
    })()

    // Fade out over bare paper; with alpha-to-coverage the MSAA samples give a smooth edge,
    // and the paste never z-fights the ground.
    mat.opacityNode = smoothstep(0.015, 0.07, hMm)
    mat.alphaToCoverage = true
    mat.alphaTest = 0.01

    const normalWorld = Fn(() => {
      const hl = at(vec2(texel.x.negate(), 0)).r
      const hr = at(vec2(texel.x, 0)).r
      const hd = at(vec2(0, texel.y.negate())).r
      const hu = at(vec2(0, texel.y)).r
      // mm per metre → slope (both in mm): dh/dx = (hr − hl) / (2 dx_mm)
      const gx = hr.sub(hl).div(2 * dx * 1000).toVar()
      const gz = hu.sub(hd).div(2 * dx * 1000).toVar()

      const p = positionWorld.xz.mul(1000) // mm
      const t = at(vec2(0, 0))
      const thick = smoothstep(0.25, 1.2, t.r)
      if (detailMap) {
        // Detail map: R = pit depth, G/B = two smooth noises (baked; no per-pixel noise).
        const duv = p.div(DETAIL_TILE_MM)
        const e = 2 / DETAIL_RES
        const c = texture(detailMap, duv)
        // Nozzle striations: fine grooves running along the bead (doubled-angle direction).
        const theta = atan(t.b, t.g).mul(0.5)
        const along = vec2(cos(theta), sin(theta))
        const across = vec2(along.y.negate(), along.x)
        const phase = p.dot(across).div(0.42).add(c.g.mul(1.5))
        const fade = float(1).sub(smoothstep(0.25, 0.9, fwidth(phase)))
        const amp = u.striation.mul(0.09).mul(thick).mul(fade).mul(c.b.mul(0.5).add(0.6))
        const s = cos(phase.mul(6.2831853)).mul(amp)
        gx.addAssign(across.x.mul(s))
        gz.addAssign(across.y.mul(s))
        // Sparse air-bubble pits.
        const cx = texture(detailMap, duv.add(vec2(e, 0))).r.sub(c.r).div(e * DETAIL_TILE_MM)
        const cz = texture(detailMap, duv.add(vec2(0, e))).r.sub(c.r).div(e * DETAIL_TILE_MM)
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
    mat.colorNode = mix(u.shadowTint, u.base, smoothstep(0.03, 0.35, hMm))
    mat.roughnessNode = u.roughness
    mat.metalnessNode = float(0)
    mat.clearcoatNode = u.clearcoat
    mat.clearcoatRoughnessNode = u.clearcoatRoughness
    mat.specularColorNode = u.highlightTint
    mat.specularIntensityNode = float(0.3)
    mat.emissiveNode = u.shadowTint.mul(smoothstep(0.4, 0.05, hMm).mul(0.015))
    if (glossEnv) {
      mat.envMap = glossEnv
      mat.envMapIntensity = 1
    }
    return mat
  }

  /** Convert changed tiles into their texture layers and flag those layers. Returns whether anything changed. */
  update(): boolean {
    const tiles = this.field.takeDirty(0)
    if (tiles.length === 0) return false
    const f = this.field
    const { data, texW, layerSize, tex } = this
    const ntx = f.tilesX
    const layers = this.meshes.length
    for (const id of tiles) {
      const ti0 = (id % ntx) * TILE
      const ti1 = Math.min(f.nx, ti0 + TILE)
      const tk0 = ((id / ntx) | 0) * TILE
      const tk1 = Math.min(f.nz, tk0 + TILE)
      // The tile's own layer, plus a neighbour whose apron reaches into it.
      const l0 = Math.max(0, Math.floor((ti0 - APRON) / CHUNK))
      const l1 = Math.min(layers - 1, Math.floor((ti1 - 1 + APRON) / CHUNK))
      for (let layer = l0; layer <= l1; layer++) {
        const lx0 = layer * CHUNK - APRON // field column of texel x = 0
        const i0 = Math.max(ti0, lx0)
        const i1 = Math.min(ti1, lx0 + texW)
        if (i1 <= i0) continue
        const base = layer * layerSize
        let any = false
        for (let k = tk0; k < tk1; k++) {
          let o = base + (k * texW + (i0 - lx0)) * 4
          for (let i = i0, id2 = k * f.nx + i0; i < i1; i++, id2++, o += 4) {
            const h = f.h[id2]
            data[o] = toHalf(h * 1000)
            const inv = h > 1e-7 ? 1 / h : 0
            data[o + 1] = toHalf(f.dirC[id2] * inv)
            data[o + 2] = toHalf(f.dirS[id2] * inv)
            if (h > 2e-5) any = true
          }
        }
        if (any) this.meshes[layer].visible = true
        tex.addLayerUpdate(layer)
      }
    }
    tex.needsUpdate = true
    return true
  }

  setGloss(v: number) {
    this.gloss = v
    this.material.envMapIntensity = v
  }

  dispose() {
    this.tex.dispose()
    for (const m of this.meshes) m.geometry.dispose()
    this.material.dispose()
    this.occlusion.dispose()
  }

  /**
   * Update the coarse occlusion texture where the field changed (cheap; call at a few Hz):
   * 4×4-cell means, then a separable box blur of radius OCC_R coarse cells (≈ 4 mm), so the
   * shadow bleeds past the bead edge. `force` rebuilds everything.
   */
  updateOcclusion(force = false) {
    const f = this.field
    const changed = f.takeDirty(1)
    if (!force && changed.length === 0) return
    const ntx = f.tilesX
    const ntz = f.tilesZ
    const W = this.occW
    const H = this.occH
    const a = this.occA
    const b = this.occB
    const C = TILE / OCC // coarse cells per tile side
    const tiles = force ? Array.from({ length: ntx * ntz }, (_, i) => i) : changed
    // Mark the tiles whose blurred output can change: changed tiles and their 8 neighbours.
    const mark = new Uint8Array(ntx * ntz)
    for (const id of tiles) {
      const t = id % ntx
      const s = (id / ntx) | 0
      // 1) coarse means of the changed tile
      for (let y = s * C; y < Math.min(H, s * C + C); y++)
        for (let x = t * C; x < Math.min(W, t * C + C); x++) {
          let sum = 0
          for (let k = y * OCC; k < Math.min(f.nz, y * OCC + OCC); k++)
            for (let i = x * OCC; i < Math.min(f.nx, x * OCC + OCC); i++) sum += f.h[k * f.nx + i]
          a[y * W + x] = (sum / (OCC * OCC)) * 1000
        }
      for (let ds = -1; ds <= 1; ds++)
        for (let dt = -1; dt <= 1; dt++) {
          const ss = s + ds
          const tt = t + dt
          if (ss >= 0 && tt >= 0 && ss < ntz && tt < ntx) mark[ss * ntx + tt] = 1
        }
    }
    // 2) horizontal pass over marked tiles (reads a within ±R: at most one tile away)
    for (let id = 0; id < mark.length; id++) {
      if (!mark[id]) continue
      const t = id % ntx
      const s = (id / ntx) | 0
      for (let y = s * C; y < Math.min(H, s * C + C); y++)
        for (let x = t * C; x < Math.min(W, t * C + C); x++) {
          let sum = 0
          let n = 0
          for (let d = -OCC_R; d <= OCC_R; d++) {
            const xx = x + d
            if (xx < 0 || xx >= W) continue
            sum += a[y * W + xx]
            n++
          }
          b[y * W + x] = sum / n
        }
    }
    // 3) vertical pass: needs b one tile up/down, which the neighbour marks already cover for
    //    every changed column; unmarked b is unchanged from the last update.
    for (let id = 0; id < mark.length; id++) {
      if (!mark[id]) continue
      const t = id % ntx
      const s = (id / ntx) | 0
      for (let y = s * C; y < Math.min(H, s * C + C); y++)
        for (let x = t * C; x < Math.min(W, t * C + C); x++) {
          let sum = 0
          let n = 0
          for (let d = -OCC_R; d <= OCC_R; d++) {
            const yy = y + d
            if (yy < 0 || yy >= H) continue
            sum += b[yy * W + x]
            n++
          }
          this.occData[(y * W + x) * 4] = toHalf((sum / n) * 2.2)
        }
    }
    this.occlusion.needsUpdate = true
  }
}

/**
 * Tileable detail map for the paste normals, baked once:
 *  R  sparse small round air pits (Worley cells picked by noise), depth 0..1
 *  G  smooth noise at 0.35 /mm (jitters the striation phase)
 *  B  smooth noise at 0.6 /mm (modulates the striation depth)
 * Each channel is cross-faded across the tile so it wraps seamlessly; the noises are
 * renormalised so the cross-fade doesn't flatten them in the middle.
 */
export function bakeDetail(renderer: THREE.WebGPURenderer): THREE.RenderTarget {
  const rt = new THREE.RenderTarget(DETAIL_RES, DETAIL_RES, { type: THREE.HalfFloatType, depthBuffer: false })
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping
  rt.texture.magFilter = rt.texture.minFilter = THREE.LinearFilter
  const T = DETAIL_TILE_MM
  const pit = (q: N): N => {
    const cell = mx_worley_noise_float(q.mul(0.55))
    const pick = smoothstep(0.58, 0.64, mx_noise_float(q.mul(0.21).add(vec2(3.1, 7.7))))
    return smoothstep(0.17, 0.0, cell).mul(pick)
  }
  const colour = Fn(() => {
    const q = uv().mul(T)
    const w = uv()
    const wa = float(1).sub(w.x).mul(float(1).sub(w.y))
    const wb = w.x.mul(float(1).sub(w.y))
    const wc = float(1).sub(w.x).mul(w.y)
    const wd = w.x.mul(w.y)
    const qa = q
    const qb = q.sub(vec2(T, 0))
    const qc = q.sub(vec2(0, T))
    const qd = q.sub(vec2(T, T))
    const blend = (fn: (p: N) => N): N => fn(qa).mul(wa).add(fn(qb).mul(wb)).add(fn(qc).mul(wc)).add(fn(qd).mul(wd))
    const norm = sqrt(wa.mul(wa).add(wb.mul(wb)).add(wc.mul(wc)).add(wd.mul(wd)))
    const r = blend(pit)
    const g = blend((p) => mx_noise_float(p.mul(0.35))).div(norm)
    const b = blend((p) => mx_noise_float(p.mul(0.6))).div(norm)
    return vec3(r, g, b)
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
  const idx = new Uint32Array(sx * sz * 6)
  let n = 0
  for (let k = 0; k < sz; k++)
    for (let i = 0; i < sx; i++) {
      const a = k * (sx + 1) + i
      const b = a + 1
      const c = a + sx + 1
      const e = c + 1
      idx[n++] = a
      idx[n++] = c
      idx[n++] = b
      idx[n++] = b
      idx[n++] = c
      idx[n++] = e
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((sx + 1) * (sz + 1) * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}
