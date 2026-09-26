/**
 * Charcoal-on-paper ground.
 *
 * The whole visible sheet is baked once on the GPU into a non-repeating texture
 * (≈0.3 mm/texel at high quality): paper tooth and fibres, charcoal strokes laid in several
 * directions that catch on the tooth peaks, lighter lifted streaks, soft smudges, a denser
 * band and a hatched corner. At render time the paper costs a handful of texture reads:
 * albedo, bump from the tooth height, and contact occlusion from the paste.
 */
import * as THREE from 'three/webgpu'
import {
  Fn,
  bumpMap,
  clamp,
  cos,
  exp,
  float,
  fract,
  max,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  positionWorld,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

// TSL's TypeScript types are narrower than its runtime; shader glue uses a loose node type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

/** World rectangle (m) covered by the bake; beyond it the texture mirrors. */
export const PAPER_RECT = { x0: -0.62, z0: -0.42, w: 1.24, d: 0.76 }

/** Albedo is stored as sqrt(L / L_MAX) for 8-bit precision in the darks. */
const L_MAX = 0.22

const rot = (p: N, a: number): N => vec2(p.x.mul(Math.cos(a)).sub(p.y.mul(Math.sin(a))), p.x.mul(Math.sin(a)).add(p.y.mul(Math.cos(a))))

/** One family of charcoal strokes at angle `a` (rad): bands `width` m wide, `len` m long. */
const strokes = (p: N, a: number, width: number, len: number, seed: number, amount: number): N => {
  const q = rot(p, a)
  const across = mx_noise_float(vec3(q.x.div(len), q.y.div(width), seed)).mul(0.5).add(0.5)
  const band = smoothstep(0.55, 0.75, across)
  const alongGap = smoothstep(0.35, 0.6, mx_noise_float(vec3(q.x.div(len * 0.6), q.y.div(width * 3), seed + 11)).mul(0.5).add(0.5))
  // Drag texture inside the stroke: fine lines along the stroke direction.
  const drag = mx_noise_float(vec3(q.x.div(0.02), q.y.div(0.00035), seed + 3)).mul(0.5).add(0.5)
  return band.mul(alongGap).mul(float(0.85).add(drag.mul(0.15))).mul(amount)
}

export function bakePaper(renderer: THREE.WebGPURenderer, width = 4096): THREE.RenderTarget {
  const height = Math.round((width * PAPER_RECT.d) / PAPER_RECT.w)
  const rt = new THREE.RenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  })
  rt.texture.wrapS = rt.texture.wrapT = THREE.MirroredRepeatWrapping
  rt.texture.anisotropy = 8

  const bake = Fn(() => {
    const p = vec2(uv().x.mul(PAPER_RECT.w).add(PAPER_RECT.x0), uv().y.mul(PAPER_RECT.d).add(PAPER_RECT.z0))
    // Paper tooth (~0.45 mm) and felt fibres wandering in direction.
    const tooth = mx_fractal_noise_float(vec3(p.mul(2200), 0.5), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const fa = mx_noise_float(vec3(p.mul(30), 2.2)).mul(3.1)
    const fq = vec2(p.x.mul(cos(fa)).sub(p.y.mul(sin(fa))), p.x.mul(sin(fa)).add(p.y.mul(cos(fa))))
    const fibre = mx_noise_float(vec3(fq.x.mul(900), fq.y.mul(9000), 4.4)).mul(0.5).add(0.5)
    const relief = clamp(tooth.mul(0.8).add(fibre.mul(0.2)), 0, 1)

    // Charcoal coverage: mostly covered sheet, strokes at a few angles, a denser band.
    const base = mx_fractal_noise_float(vec3(p.mul(3.2), 7.7), 3, 2, 0.55).mul(0.5).add(0.5)
    let cover: N = float(0.55).add(base.mul(0.3))
    cover = cover.add(strokes(p, -0.1, 0.012, 0.22, 1, 0.35))
    cover = cover.add(strokes(p, 0.22, 0.008, 0.16, 2, 0.25))
    cover = cover.add(strokes(p, -0.55, 0.018, 0.3, 3, 0.2))
    const band = exp(p.y.add(0.085).div(0.03).pow(2).negate())
    cover = cover.add(strokes(p, -0.03, 0.004, 0.12, 4, 0.5).mul(band))
    // Hatching in the upper-left corner.
    const corner = smoothstep(-0.2, -0.32, p.x).mul(smoothstep(-0.06, -0.15, p.y))
    const hq = rot(p, 0.87)
    const hatch = smoothstep(0.5, 0.9, fract(hq.y.mul(310).add(mx_noise_float(vec3(p.mul(40), 5)).mul(0.5))))
      .mul(smoothstep(0.35, 0.6, mx_noise_float(vec3(hq.x.mul(25), hq.y.mul(4), 8)).mul(0.5).add(0.5)))
    cover = cover.add(hatch.mul(corner).mul(0.4))
    // Lifted (erased / rubbed) streaks let the paper show through.
    const lift = strokes(p, 0.05, 0.02, 0.3, 9, 1).mul(0.16).add(strokes(p, -0.35, 0.03, 0.25, 13, 1).mul(0.1))
    cover = clamp(cover.sub(lift), 0, 1)

    // Charcoal sits on the tooth peaks first: partial coverage leaves valleys lighter.
    const onTooth = smoothstep(float(1).sub(cover), float(1).sub(cover).add(0.28), relief)
    const smudge = mx_fractal_noise_float(vec3(p.mul(18), 3.3), 2, 2, 0.5).mul(0.5).add(0.5).mul(0.35)
    const coverage = clamp(max(onTooth, cover.mul(0.7).add(smudge.mul(cover))), 0, 1)
    const paper = float(0.1).mul(float(0.85).add(fibre.mul(0.15)))
    const charcoal = float(0.014).add(mx_noise_float(vec3(p.mul(900), 6)).mul(0.004))
    const L = mix(paper, charcoal, coverage)
    return vec4(L.div(L_MAX).sqrt(), relief, coverage, 1)
  })

  const bakeMat = new THREE.MeshBasicNodeMaterial({ colorNode: bake() })
  const quad = new THREE.QuadMesh(bakeMat)
  const prev = renderer.getRenderTarget()
  const prevTone = renderer.toneMapping
  renderer.setRenderTarget(rt)
  quad.render(renderer)
  renderer.setRenderTarget(prev)
  renderer.toneMapping = prevTone
  bakeMat.dispose()
  return rt
}

export interface PaperOptions {
  bake: THREE.Texture
  /** coarse blurred paste height (mm in R) covering the field rect */
  occlusion: THREE.Texture
  fieldRect: { x0: number; z0: number; w: number; d: number }
}

export function createPaper(o: PaperOptions) {
  const u = {
    tone: uniform(1.0),
    occlusionStrength: uniform(0.8),
    toothBump: uniform(0.45),
    /** 0 = normal, 1 = receded behind content */
    dim: uniform(0),
  }
  const buv = vec2(positionWorld.x.sub(PAPER_RECT.x0).div(PAPER_RECT.w), positionWorld.z.sub(PAPER_RECT.z0).div(PAPER_RECT.d))
  const s = texture(o.bake, buv)

  const albedo = Fn(() => {
    const L = s.r.mul(s.r).mul(L_MAX)
    const fuv = vec2(positionWorld.x.sub(o.fieldRect.x0).div(o.fieldRect.w), positionWorld.z.sub(o.fieldRect.z0).div(o.fieldRect.d))
    const hb = texture(o.occlusion, fuv).r
    const occl = float(1).sub(smoothstep(0.0, 2.0, hb).mul(u.occlusionStrength))
    const v = L.mul(occl).mul(u.tone).mul(mix(float(1), float(0.45), u.dim))
    // Neutral-to-cool graphite grey.
    return vec3(v.mul(0.97), v, v.mul(1.05))
  })

  const mat = new THREE.MeshStandardNodeMaterial()
  mat.colorNode = albedo()
  // Compressed charcoal has a faint sheen where it's densest; bare tooth is fully matte.
  mat.roughnessNode = mix(float(0.97), float(0.78), s.b.mul(s.b))
  mat.metalnessNode = float(0)
  mat.normalNode = bumpMap(texture(o.bake, buv).g, u.toothBump)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), mat)
  mesh.receiveShadow = true
  return { mesh, uniforms: u }
}
