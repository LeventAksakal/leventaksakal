/**
 * Renderer, camera rig and lighting for the desk scene.
 * WebGPURenderer with TSL materials; falls back to its WebGL2 backend automatically
 * (or on request with ?webgl).
 */
import * as THREE from 'three/webgpu'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface StageOptions {
  canvas: HTMLCanvasElement
  forceWebGL?: boolean
  maxDpr?: number
}

export interface CameraRig {
  /** degrees from straight down */
  pitch: number
  /** degrees around the vertical */
  yaw: number
  /** degrees of roll */
  roll: number
  /** vertical field of view in degrees */
  fov: number
  /** world width (m) that must fit across the view */
  frameWidth: number
  target: THREE.Vector3
}

export async function createStage(o: StageOptions) {
  const renderer = new THREE.WebGPURenderer({ canvas: o.canvas, antialias: true, forceWebGL: o.forceWebGL ?? false })
  await renderer.init()
  renderer.setPixelRatio(Math.min(o.maxDpr ?? 2, window.devicePixelRatio || 1))
  // Neutral keeps the cadmium saturated where AgX drifts bright yellows toward beige.
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#060606')

  // Small studio environment for reflections: gives the wet paint its softbox highlights.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.02).texture
  scene.environment = env
  scene.environmentIntensity = 0.5

  // Key: large warm light, low-ish from the upper left, for long highlights along the bead.
  const key = new THREE.DirectionalLight('#ffe7cf', 2.8)
  key.position.set(-0.26, 0.5, -0.2)
  key.target.position.set(0, 0, 0)
  key.castShadow = true
  key.shadow.mapSize.set(4096, 4096)
  const sc = key.shadow.camera as THREE.OrthographicCamera
  sc.left = -0.3
  sc.right = 0.3
  sc.top = 0.22
  sc.bottom = -0.22
  sc.near = 0.05
  sc.far = 1.4
  key.shadow.bias = -0.00015
  key.shadow.normalBias = 0.0004
  key.shadow.radius = 6
  scene.add(key, key.target)

  // Soft sky fill so shadows stay readable (charcoal is dark enough on its own).
  const fill = new THREE.HemisphereLight('#c9d6ff', '#1a1714', 0.35)
  scene.add(fill)

  // Cool rim from behind right.
  const rim = new THREE.DirectionalLight('#b9cdff', 0.9)
  rim.position.set(0.4, 0.22, -0.5)
  scene.add(rim)

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 8)
  const rig: CameraRig = { pitch: 36, yaw: 4, roll: 1.5, fov: 28, frameWidth: 0.47, target: new THREE.Vector3(0, 0, 0.004) }

  function placeCamera(extraYaw = 0, extraPitch = 0) {
    const w = o.canvas.clientWidth || 1
    const h = o.canvas.clientHeight || 1
    camera.aspect = w / h
    camera.fov = rig.fov
    const vfov = THREE.MathUtils.degToRad(rig.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const dist = rig.frameWidth / 2 / Math.tan(hfov / 2)
    const pitch = THREE.MathUtils.degToRad(rig.pitch + extraPitch)
    const yaw = THREE.MathUtils.degToRad(rig.yaw + extraYaw)
    const elev = Math.PI / 2 - pitch
    camera.position.set(
      rig.target.x + dist * Math.cos(elev) * Math.sin(yaw),
      rig.target.y + dist * Math.sin(elev),
      rig.target.z + dist * Math.cos(elev) * Math.cos(yaw),
    )
    camera.up.set(0, 1, 0)
    camera.lookAt(rig.target)
    camera.rotateZ(THREE.MathUtils.degToRad(rig.roll))
    camera.updateProjectionMatrix()
  }

  function resize() {
    const w = o.canvas.clientWidth
    const h = o.canvas.clientHeight
    renderer.setSize(w, h, false)
    placeCamera()
  }

  return { renderer, scene, camera, rig, key, rim, fill, placeCamera, resize, backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2' }
}
