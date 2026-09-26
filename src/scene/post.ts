/**
 * Post: subtle tilt-shift (the macro/miniature feel; focus band follows the nozzle), bloom
 * only on specular peaks, fine film grain, slight vignette, and the fade from black.
 * Tone mapping and output colour space are applied by the pipeline at the end.
 */
import * as THREE from 'three/webgpu'
import { abs, dot, float, fract, length, mix, pass, screenUV, sin, smoothstep, time, uniform, vec2, vec4 } from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { gaussianBlur } from 'three/examples/jsm/tsl/display/GaussianBlurNode.js'
import type { Quality } from './stage'

export function createPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, quality: Quality) {
  const u = {
    /** 0 = black, 1 = full image */
    fade: uniform(0),
    /** screen-space y (0 = bottom, 1 = top) of the focus band */
    focusY: uniform(0.55),
    /** half-height of the sharp band */
    focusBand: uniform(0.16),
    /** 0..1 amount of out-of-focus blur */
    tiltShift: uniform(1),
    grain: uniform(0.045),
    vignette: uniform(0.35),
  }
  const scenePass = pass(scene, camera)
  const colour = scenePass.getTextureNode()
  let out = colour.rgb

  if (quality !== 'low') {
    const blurred = gaussianBlur(colour, null, 3, { resolutionScale: 0.5 }).rgb
    const d = abs(screenUV.y.oneMinus().sub(u.focusY))
    const m = smoothstep(u.focusBand, u.focusBand.add(0.28), d).mul(u.tiltShift)
    out = mix(out, blurred, m)
    out = out.add(bloom(colour, 0.08, 0.25, 1.4).rgb)
  }

  // Vignette.
  const r = length(screenUV.sub(0.5).mul(vec2(1.25, 1)))
  out = out.mul(float(1).sub(smoothstep(0.35, 0.95, r).mul(u.vignette)))
  // Film grain, luminance-proportional so the blacks stay black.
  const n = fract(sin(dot(screenUV.mul(vec2(1920, 1080)).add(fract(time.mul(13.1)).mul(97.3)), vec2(12.9898, 78.233))).mul(43758.5453))
  out = out.mul(float(1).add(n.sub(0.5).mul(u.grain)))
  out = out.mul(u.fade)

  const pipeline = new THREE.RenderPipeline(renderer)
  pipeline.outputNode = vec4(out, 1)
  return { pipeline, uniforms: u }
}
