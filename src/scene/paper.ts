/**
 * Charcoal-on-paper ground.
 *
 * A tileable detail texture (paper tooth + fine directional charcoal streaks) is baked once on
 * the GPU; the paper shader layers non-repeating low-frequency smudges, a denser horizontal
 * band and a hatched corner on top, and darkens the paper under and around the paste
 * (contact occlusion from the blurred height field).
 */
import * as THREE from 'three/webgpu'
import {
  Fn,
  bumpMap,
  clamp,
  exp,
  float,
  fract,
  mx_fractal_noise_float,
  mx_noise_float,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

/** m — world size of one tile of the baked detail texture */
export const PAPER_TILE = 0.32

// TSL's TypeScript types are narrower than its runtime; shader glue uses a loose node type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

/** Tileable noise by cross-fading four offset copies (period T in the same units as p). */
const tileable = (fn: (p: N) => N, p: N, T: number): N => {
  const w = p.div(T)
  const a = fn(p).mul(float(1).sub(w.x)).mul(float(1).sub(w.y))
  const b = fn(p.sub(vec2(T, 0))).mul(w.x).mul(float(1).sub(w.y))
  const c = fn(p.sub(vec2(0, T))).mul(float(1).sub(w.x)).mul(w.y)
  const d = fn(p.sub(vec2(T, T))).mul(w.x).mul(w.y)
  return a.add(b).add(c).add(d) as N
}

export function bakePaperDetail(renderer: THREE.WebGPURenderer, size = 2048): THREE.RenderTarget {
  const rt = new THREE.RenderTarget(size, size, {
    type: THREE.HalfFloatType,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  })
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping
  const T = PAPER_TILE
  const detail = Fn(() => {
    const p = uv().mul(T) // metres within the tile
    // Paper tooth: ~0.5 mm grain.
    const tooth = tileable((q) => mx_fractal_noise_float(vec3(q.mul(1900), 0.5), 4, 2.1, 0.55) as N, p, T)
    // Fine charcoal streaks: strongly anisotropic, mostly horizontal, slightly warped.
    const warp = tileable((q) => mx_noise_float(vec3(q.mul(40), 7.1)) as N, p, T)
    const streak = tileable(
      (q) => mx_fractal_noise_float(vec3(q.x.mul(55), q.y.mul(900).add(warp.mul(6)), 3.3), 3, 2, 0.5) as N,
      p,
      T,
    )
    // Pigment speckle sitting in the tooth.
    const speck = tileable((q) => mx_noise_float(vec3(q.mul(5200), 9.9)) as N, p, T)
    return vec4(tooth.mul(0.5).add(0.5), streak.mul(0.5).add(0.5), speck.mul(0.5).add(0.5), 1)
  })
  const quad = new THREE.QuadMesh(new THREE.MeshBasicNodeMaterial({ colorNode: detail() }))
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt)
  quad.render(renderer)
  renderer.setRenderTarget(prev)
  return rt
}

export interface PaperOptions {
  detail: THREE.Texture
  /** coarse blurred paste height (mm in R) covering the field rect */
  occlusion: THREE.Texture
  fieldRect: { x0: number; z0: number; w: number; d: number }
}

export function createPaper(o: PaperOptions) {
  const u = {
    tone: uniform(0.5),
    occlusionStrength: uniform(0.75),
    toothBump: uniform(0.9),
  }
  const pw = positionWorld.xz
  const tileUV = pw.div(PAPER_TILE)
  const d = texture(o.detail, tileUV)

  const albedo = Fn(() => {
    const p = pw
    // Non-repeating large smudges and rubbed areas.
    const smudge = mx_fractal_noise_float(vec3(p.mul(4.5), 1.3), 3, 2, 0.55).mul(0.5).add(0.5)
    const rub = smoothstep(0.45, 0.8, mx_fractal_noise_float(vec3(p.x.mul(2.2), p.y.mul(9), 4.2), 2, 2, 0.5).mul(0.5).add(0.5))
    // A denser horizontal band of strokes across the upper page.
    const band = exp(p.y.add(0.085).div(0.035).pow(2).negate())
    const bandStrokes = smoothstep(0.52, 0.75, mx_noise_float(vec3(p.x.mul(14), p.y.mul(160), 2.0)).mul(0.5).add(0.5)).mul(band)
    // Directional hatching in the upper-left corner.
    const corner = smoothstep(-0.2, -0.3, p.x).mul(smoothstep(-0.07, -0.14, p.y))
    const hatchCoord = p.x.mul(0.64).add(p.y.mul(0.77)).mul(260)
    const hatch = smoothstep(0.78, 0.95, fract(hatchCoord.add(mx_noise_float(vec3(p.mul(30), 5)).mul(0.6))))
      .mul(smoothstep(0.3, 0.6, mx_noise_float(vec3(p.mul(18), 8)).mul(0.5).add(0.5)))
      .mul(corner)
    const streaks = smoothstep(0.58, 0.9, d.g).mul(0.7)
    // Blotchy rubbed charcoal: soft patches at several scales, a few with a direction.
    const blot = smoothstep(0.35, 0.75, mx_fractal_noise_float(vec3(p.mul(11), 6.6), 4, 2.2, 0.55).mul(0.5).add(0.5))
    let v = float(0.03)
      .add(smudge.mul(0.03))
      .add(blot.mul(0.035))
      .add(rub.mul(0.015))
      .add(streaks.mul(0.018).mul(smudge.add(0.3)))
      .add(bandStrokes.mul(0.035))
      .add(hatch.mul(0.035))
    // Paper tooth: pigment catches on the peaks.
    v = v.mul(float(0.82).add(d.r.mul(0.36))).add(d.b.sub(0.5).mul(0.006))
    // Contact occlusion from the paste.
    const fuv = vec2(p.x.sub(o.fieldRect.x0).div(o.fieldRect.w), p.y.sub(o.fieldRect.z0).div(o.fieldRect.d))
    const hb = texture(o.occlusion, fuv).r
    const occl = float(1).sub(smoothstep(0.0, 2.2, hb).mul(u.occlusionStrength))
    v = v.mul(occl).mul(u.tone)
    // Slightly warm grey, like willow charcoal on off-white stock seen in low light.
    // Neutral-to-cool graphite grey.
    return vec3(v.mul(0.97), v, v.mul(1.04))
  })

  const mat = new THREE.MeshStandardNodeMaterial()
  mat.colorNode = albedo()
  mat.roughnessNode = clamp(float(0.93).sub(d.g.sub(0.5).mul(0.08)), 0.7, 1)
  mat.metalnessNode = float(0)
  mat.normalNode = bumpMap(texture(o.detail, tileUV).r, u.toothBump)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), mat)
  mesh.receiveShadow = true
  return { mesh, uniforms: u }
}
