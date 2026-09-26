/**
 * Renderer, camera rig and lighting for the desk scene.
 * WebGPURenderer with TSL materials; falls back to its WebGL2 backend automatically
 * (or on request with ?webgl).
 *
 * Lighting is a small product-photography setup: a large warm softbox as key (it also casts
 * the shadows), a cool strip light behind for the rim, and a dim fill card. The same
 * softboxes are baked into the environment map, so the wet paint reflects their shapes as
 * long highlights instead of a generic room.
 */
import * as THREE from 'three/webgpu'
import { color, float, mix, normalWorld, smoothstep, vec3 } from 'three/tsl'

export type Quality = 'high' | 'medium' | 'low'

export interface StageOptions {
  canvas: HTMLCanvasElement
  forceWebGL?: boolean
  quality: Quality
}

export interface CameraPose {
  /** degrees from straight down */
  pitch: number
  /** degrees around the vertical */
  yaw: number
  /** degrees of roll */
  roll: number
  /** vertical field of view in degrees */
  fov: number
  /** world width (m) that spans the viewport width at the target */
  frameWidth: number
  target: THREE.Vector3
  /** where the target appears vertically, 0 = top edge, 0.5 = centre (lens shift, no distortion) */
  screenY: number
}

/** Key light direction (from the scene toward the light). */
export const KEY_DIR = new THREE.Vector3(-0.6, 0.74, 0.3).normalize()
/** Highlight softbox (environment only): high behind the paper, so wet tops mirror it. */
export const GLOSS_DIR = new THREE.Vector3(-0.08, 0.78, -0.62).normalize()

function studioEnvironment(kind: 'fill' | 'gloss'): THREE.Scene {
  const env = new THREE.Scene()
  // Dark room with a faint floor bounce.
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      colorNode: mix(vec3(0.012, 0.012, 0.014), vec3(0.03, 0.028, 0.026), smoothstep(-0.2, 0.6, normalWorld.y.negate())),
    }),
  )
  env.add(room)
  const panel = (w: number, h: number, c: string, intensity: number, dir: THREE.Vector3, dist: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicNodeMaterial({ colorNode: color(c).mul(float(intensity)), side: THREE.DoubleSide }))
    m.position.copy(dir.clone().normalize().multiplyScalar(dist))
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  if (kind === 'fill') {
    // Broad, soft: what the matte paper sees.
    panel(11, 5, '#fff6ec', 2.2, GLOSS_DIR, 10)
    panel(4, 3, '#fff1e2', 1.6, KEY_DIR, 10)
    panel(10, 1.1, '#cfdcff', 5, new THREE.Vector3(0.55, 0.5, -0.8), 10)
    panel(4, 3, '#ffffff', 0.9, new THREE.Vector3(0.2, 0.35, 1), 10)
    panel(2.5, 2.5, '#ffe6c8', 3, new THREE.Vector3(-0.9, 0.25, 0.3), 10)
  } else {
    // Narrow, very bright strips at several azimuths behind and above: every bead, whatever its
    // direction, gets a crisp highlight line along its crest, with little added diffuse light.
    const strip = (az: number, el: number, len: number, wid: number, c: string, k: number) => {
      const a = THREE.MathUtils.degToRad(az)
      const e = THREE.MathUtils.degToRad(el)
      panel(len, wid, c, k, new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)), 10)
    }
    strip(0, 52, 9, 0.9, '#fff7ee', 22)
    strip(-50, 48, 7, 0.8, '#fff3e6', 16)
    strip(55, 45, 7, 0.8, '#dfe8ff', 14)
    strip(0, 78, 3, 3, '#fff9f2', 6) // small overhead box
    panel(3, 2, '#ffffff', 1.2, new THREE.Vector3(0.2, 0.35, 1), 10) // faint front card
  }
  return env
}

export async function createStage(o: StageOptions) {
  const renderer = new THREE.WebGPURenderer({ canvas: o.canvas, antialias: o.quality !== 'low', forceWebGL: o.forceWebGL ?? false })
  await renderer.init()
  // Neutral keeps the cadmium saturated where AgX drifts bright yellows toward beige.
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#050505')

  const pmrem = new THREE.PMREMGenerator(renderer)
  // Two versions of the same studio: a dim one lights the matte paper; glossy things (paint,
  // metal tube) reflect a bright one, so their highlights read as wet without flooding the paper.
  scene.environment = pmrem.fromScene(studioEnvironment('fill'), 0.0).texture
  scene.environmentIntensity = 0.45
  const glossEnv = pmrem.fromScene(studioEnvironment('gloss'), 0.0).texture

  const key = new THREE.DirectionalLight('#fff3e6', 2.6)
  key.position.copy(KEY_DIR).multiplyScalar(0.6)
  key.castShadow = true
  const sm = o.quality === 'low' ? 512 : 1024
  key.shadow.mapSize.set(sm, sm)
  const sc = key.shadow.camera as THREE.OrthographicCamera
  sc.left = -0.27
  sc.right = 0.27
  sc.top = 0.2
  sc.bottom = -0.2
  sc.near = 0.2
  sc.far = 1.1
  key.shadow.bias = -0.0002
  key.shadow.normalBias = 0.0006
  key.shadow.radius = 4
  scene.add(key, key.target)

  const fill = new THREE.HemisphereLight('#c3d2ff', '#121316', 0.3)
  const rim = new THREE.DirectionalLight('#bcd0ff', 0.9)
  rim.position.set(0.4, 0.3, -0.55)
  scene.add(fill, rim)

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 8)
  const pose: CameraPose = { pitch: 36, yaw: 4, roll: 1.5, fov: 28, frameWidth: 0.47, target: new THREE.Vector3(0, 0, 0.004), screenY: 0.5 }

  function placeCamera(p: CameraPose = pose) {
    const w = o.canvas.clientWidth || 1
    const h = o.canvas.clientHeight || 1
    camera.aspect = w / h
    camera.fov = p.fov
    const vfov = THREE.MathUtils.degToRad(p.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const dist = p.frameWidth / 2 / Math.tan(hfov / 2)
    const pitch = THREE.MathUtils.degToRad(p.pitch)
    const yaw = THREE.MathUtils.degToRad(p.yaw)
    const elev = Math.PI / 2 - pitch
    camera.position.set(
      p.target.x + dist * Math.cos(elev) * Math.sin(yaw),
      p.target.y + dist * Math.sin(elev),
      p.target.z + dist * Math.cos(elev) * Math.cos(yaw),
    )
    camera.up.set(0, 1, 0)
    camera.lookAt(p.target)
    camera.rotateZ(THREE.MathUtils.degToRad(p.roll))
    if (Math.abs(p.screenY - 0.5) > 1e-4) camera.setViewOffset(w, h, 0, h * (0.5 - p.screenY), w, h)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }

  function resize(dpr: number) {
    renderer.setPixelRatio(dpr)
    renderer.setSize(o.canvas.clientWidth, o.canvas.clientHeight, false)
    placeCamera()
  }

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2'
  return { renderer, scene, camera, pose, key, rim, fill, glossEnv, placeCamera, resize, backend }
}

export type Stage = Awaited<ReturnType<typeof createStage>>
