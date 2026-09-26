/**
 * Milestone 2 lab: the full Tier-1 paste simulation in the lit 3D desk scene, with every
 * physical and look parameter exposed. Physics edits restart the (deterministic) run.
 */
import GUI from 'lil-gui'
import * as THREE from 'three/webgpu'
import damion from '../lettering/Damion.strokes.json'
import nycd from '../lettering/NothingYouCouldDo.strokes.json'
import type { StrokeSet } from '../lettering/types'
import { defaultKinematics, type KinematicsParams } from '../physics/kinematics'
import { defaultPhysics, type PhysicsParams } from '../physics/params'
import { derive } from '../physics/rheology'
import { PasteSimulation } from '../physics/simulation'
import { PaintTube } from '../scene/paintTube'
import { createPaper, bakePaperDetail } from '../scene/paper'
import { PasteSurface } from '../scene/paste'
import { createStage } from '../scene/stage'
import { ThreadMesh } from '../scene/threadMesh'

const query = new URLSearchParams(location.search)
const fonts: Record<string, StrokeSet> = { nycd: nycd as StrokeSet, damion: damion as StrokeSet }
const view = { font: query.get('font') === 'damion' ? 'damion' : 'nycd', rate: 1, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches }
const PRESET_KEY = 'lab.paste.preset.v1'

const kin: KinematicsParams = {
  ...defaultKinematics,
  nozzleHeight: 4,
  drawDuration: 12.5,
  liftMin: 0.22,
  liftMax: 0.45,
  liftHeight: 22,
  beadWidth: 4.4,
  areaRatioMax: 1.5,
}
const phys: PhysicsParams = { ...defaultPhysics }
loadPreset()

const INTRO = -0.9 // s: tube enters before first touch
const OUTRO = 1.4 // s after settling: tube gone, hold

const statusEl = document.querySelector<HTMLParagraphElement>('#status')!
const clockEl = document.querySelector<HTMLOutputElement>('#clock')!
const scrub = document.querySelector<HTMLInputElement>('#scrub')!
const playBtn = document.querySelector<HTMLButtonElement>('#play')!
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!

const stage = await createStage({ canvas, forceWebGL: query.has('webgl'), maxDpr: Number(query.get('dpr') ?? 2) })
const { renderer, scene, camera } = stage
stage.resize()
window.addEventListener('resize', () => stage.resize())

const paperDetail = bakePaperDetail(renderer, query.has('lowres') ? 1024 : 2048)

let sim!: PasteSimulation
let paste!: PasteSurface
let threadMesh!: ThreadMesh
let paper!: ReturnType<typeof createPaper>
const tube = new PaintTube()
scene.add(tube.group)

function build() {
  if (paste) scene.remove(paste.group)
  if (threadMesh) scene.remove(threadMesh.mesh)
  if (paper) scene.remove(paper.mesh)
  sim = new PasteSimulation(fonts[view.font], kin, phys, INTRO)
  paste = new PasteSurface(sim.field)
  scene.add(paste.group)
  const f = sim.field
  paper = createPaper({
    detail: paperDetail.texture,
    occlusion: paste.occlusion,
    fieldRect: { x0: f.x0, z0: f.z0, w: f.nx * f.dx, d: f.nz * f.dx },
  })
  scene.add(paper.mesh)
  // Thread shares the paste look but has no height field.
  const tm = new THREE.MeshPhysicalNodeMaterial({ color: paste.uniforms.base.value, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.07 })
  threadMesh = new ThreadMesh(sim.thread.n, tm)
  scene.add(threadMesh.mesh)
  applyLook()
}

function restart(at = INTRO) {
  build()
  if (at > INTRO) sim.advanceTo(at)
  acc = 0
}

// ------------------------------------------------------------------ frame loop
let acc = 0
let last = performance.now()
let fpsAvg = 60
let simMs = 0
let lastStatus = 0
const tip = new THREE.Vector3()
const travel = new THREE.Vector2(1, 0)

function end() {
  return sim.endTime + OUTRO
}

function tubeTip(t: number): THREE.Vector3 {
  tip.set(sim.tip.x, sim.tip.y, sim.tip.z)
  const away = new THREE.Vector3(0.16, 0.11, -0.12)
  if (t < 0) tip.addScaledVector(away, Math.pow(Math.min(1, -t / -INTRO), 2))
  const tEnd = sim.plan.tEnd
  if (t > tEnd) tip.addScaledVector(away, Math.pow(Math.min(1, (t - tEnd) / 0.9), 2) * 1.4)
  return tip
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.05
  if (view.playing && sim.t < end()) {
    acc += dt * view.rate
    const a = performance.now()
    let n = 0
    while (acc >= sim.dt && n < 40) {
      if (sim.t < sim.endTime) sim.step()
      else sim.t += sim.dt
      acc -= sim.dt
      n++
    }
    simMs += (performance.now() - a - simMs) * 0.1
    if (n === 40) acc = 0
  }
  paste.update()
  if (sim.steps % 12 === 0) paste.updateOcclusion()
  threadMesh.update(sim.thread)
  const nz = sim.nozzle
  travel.set(nz.dirX, nz.dirY)
  tube.pose(tubeTip(sim.t), travel, nz.phase === 'draw' ? nz.speed : 0, dt)
  tube.setSqueeze(sim.squeeze * 0.9)
  tube.group.visible = sim.t < sim.plan.tEnd + 1.2
  renderer.render(scene, camera)

  clockEl.textContent = `${Math.max(0, sim.t).toFixed(2)} s`
  scrub.value = String(Math.round(((sim.t - INTRO) / (end() - INTRO)) * 1000))
  if (now - lastStatus > 400) {
    lastStatus = now
    renderStatus()
  }
  requestAnimationFrame(frame)
}

function renderStatus() {
  const d = derive(phys, (kin.beadWidth * 1e-3) / 2)
  statusEl.textContent =
    `${stage.backend} · ${fpsAvg.toFixed(0)} fps · sim ${simMs.toFixed(1)} ms/frame\n` +
    `h_hold ${(d.holdHeight * 1e3).toFixed(1)} mm · ℓc ${(d.capillaryLength * 1e3).toFixed(2)} mm · Bo ${d.bond.toFixed(1)} · μp ${d.plasticViscosity.toFixed(1)} Pa·s\n` +
    `V* ${sim.stats.vStar.toFixed(2)} · tube used ${(sim.squeeze * 100).toFixed(0)}% · on paper ${(sim.field.totalVolume() * 1e6).toFixed(2)} ml`
}

// ------------------------------------------------------------------ controls
playBtn.addEventListener('click', () => setPlaying(!view.playing))
function setPlaying(v: boolean) {
  view.playing = v
  playBtn.textContent = v ? 'Pause' : 'Play'
  if (v && sim.t >= end() - 1e-3) restart()
}
document.querySelector('#restart')!.addEventListener('click', () => {
  restart()
  setPlaying(true)
})
scrub.addEventListener('change', () => {
  const t = INTRO + (Number(scrub.value) / 1000) * (end() - INTRO)
  restart(t)
})
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    setPlaying(!view.playing)
  }
})

const look = {
  exposure: 1.0,
  environment: 0.5,
  key: 2.8,
  rim: 0.9,
  paperTone: 0.5,
  occlusion: 0.75,
  base: '#eea000',
  shadowTint: '#d0780a',
  highlightTint: '#ffe08a',
  roughness: 0.32,
  clearcoat: 0.9,
  striations: 1,
  pits: 1,
  pitch: stage.rig.pitch,
  yaw: stage.rig.yaw,
  roll: stage.rig.roll,
  fov: stage.rig.fov,
  frame: stage.rig.frameWidth * 1000,
  targetX: 0,
  targetZ: 4,
}

function applyLook() {
  renderer.toneMappingExposure = look.exposure
  scene.environmentIntensity = look.environment
  stage.key.intensity = look.key
  stage.rim.intensity = look.rim
  if (paper) {
    paper.uniforms.tone.value = look.paperTone
    paper.uniforms.occlusionStrength.value = look.occlusion
  }
  if (paste) {
    const u = paste.uniforms
    u.base.value.set(look.base)
    u.shadowTint.value.set(look.shadowTint)
    u.highlightTint.value.set(look.highlightTint)
    u.roughness.value = look.roughness
    u.clearcoat.value = look.clearcoat
    u.striation.value = look.striations
    u.pits.value = look.pits
    ;(threadMesh?.mesh.material as THREE.MeshPhysicalMaterial | undefined)?.color.set(look.base)
  }
  Object.assign(stage.rig, { pitch: look.pitch, yaw: look.yaw, roll: look.roll, fov: look.fov, frameWidth: look.frame / 1000 })
  stage.rig.target.set(look.targetX / 1000, 0, look.targetZ / 1000)
  stage.placeCamera()
}

function savePreset() {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify({ kin, phys }))
  } catch {
    /* storage unavailable */
  }
}
function loadPreset() {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    if (!raw) return
    const p = JSON.parse(raw) as { kin?: Partial<KinematicsParams>; phys?: Partial<PhysicsParams> }
    Object.assign(kin, p.kin)
    Object.assign(phys, p.phys)
  } catch {
    /* ignore */
  }
}

let restartTimer = 0
function physicsChanged() {
  savePreset()
  clearTimeout(restartTimer)
  restartTimer = window.setTimeout(() => restart(), 250)
}

/** GUI helper: edit an SI value in friendlier units. */
function scaled<T extends object>(obj: T, key: keyof T, factor: number) {
  return {
    get v() {
      return (obj[key] as number) * factor
    },
    set v(x: number) {
      ;(obj[key] as number) = x / factor
    },
  }
}

const gui = new GUI({ title: 'Paste lab', container: document.querySelector<HTMLElement>('#gui')! })
gui.add(view, 'font', { 'Nothing You Could Do': 'nycd', Damion: 'damion' }).name('lettering').onChange(() => restart())
gui.add(view, 'rate', 0.05, 2, 0.05).name('playback rate')

const fr = gui.addFolder('Rheology (Herschel–Bulkley)')
fr.add(phys, 'yieldStress', 5, 300, 1).name('yield stress τy (Pa)').onChange(physicsChanged)
fr.add(phys, 'consistency', 1, 120, 0.5).name('consistency K (Pa·sⁿ)').onChange(physicsChanged)
fr.add(phys, 'flowIndex', 0.2, 1, 0.01).name('flow index n').onChange(physicsChanged)
fr.add(phys, 'referenceShearRate', 0.5, 100, 0.5).name('ref. shear rate (1/s)').onChange(physicsChanged)
fr.add(phys, 'density', 1000, 2200, 10).name('density ρ (kg/m³)').onChange(physicsChanged)
fr.add(phys, 'surfaceTension', 0.01, 0.08, 0.001).name('surface tension γ (N/m)').onChange(physicsChanged)

const fe = gui.addFolder('Extrusion & bead')
fe.add(scaled(phys, 'nozzleRadius', 1e3), 'v', 0.8, 4, 0.05).name('nozzle radius (mm)').onChange(physicsChanged)
fe.add(phys, 'dieSwell', 1, 1.5, 0.01).name('die swell').onChange(physicsChanged)
fe.add(kin, 'beadWidth', 2, 8, 0.1).name('nominal bead width (mm)').onChange(physicsChanged)
fe.add(phys, 'beadAspect', 0.3, 1, 0.01).name('fresh bead height/width').onChange(physicsChanged)
fe.add(kin, 'flowExponent', 0, 1, 0.01).name('squeeze-vs-speed φ').onChange(physicsChanged)
fe.add(kin, 'areaRatioMax', 1, 3, 0.05).name('max A/A₀ on slow curves').onChange(physicsChanged)
fe.add(phys, 'dwellFlowRatio', 0, 1, 0.01).name('first-touch flow (×Q₀)').onChange(physicsChanged)

const ft = gui.addFolder('Thread & touchdown')
ft.add(kin, 'nozzleHeight', 1, 12, 0.1).name('nozzle height (mm)').onChange(physicsChanged)
ft.add(phys, 'contactLag', 0, 2, 0.05).name('touchdown lag (× height)').onChange(physicsChanged)
ft.add(phys, 'coilOnset', 0, 1.5, 0.01).name('coil below V*').onChange(physicsChanged)
ft.add(phys, 'coilRadius', 0.5, 3, 0.05).name('coil radius (× rₑ)').onChange(physicsChanged)
ft.add(phys, 'coilAmount', 0, 1, 0.01).name('coiling').onChange(physicsChanged)
ft.add(phys, 'snapStretch', 1.2, 6, 0.05).name('snap at stretch L/L₀').onChange(physicsChanged)
ft.add(phys, 'snapRadius', 0.05, 0.6, 0.01).name('snap at neck (× rₑ)').onChange(physicsChanged)
ft.add(phys, 'tailPeakFraction', 0, 1, 0.01).name('tail peak volume').onChange(physicsChanged)
ft.add(phys, 'tailPeakRadius', 0.2, 1.2, 0.01).name('tail peak radius').onChange(physicsChanged)

const fs = gui.addFolder('Settling')
fs.add(phys, 'settleTime', 0, 3, 0.05).name('flow window (s)').onChange(physicsChanged)
fs.add(scaled(phys, 'edgeRounding', 1e7), 'v', 0, 20, 0.1).name('edge rounding (×1e-7 m²/s)').onChange(physicsChanged)
fs.add(phys, 'edgeRoundingTime', 0, 1.5, 0.05).name('rounding time (s)').onChange(physicsChanged)

const fk = gui.addFolder('Timing')
fk.add(kin, 'drawDuration', 8, 15, 0.1).name('drawing phase (s)').onChange(physicsChanged)
fk.add(kin, 'startDwell', 0, 1.2, 0.05).name('first-touch dwell (s)').onChange(physicsChanged)
fk.add(kin, 'liftMin', 0.1, 0.8, 0.01).name('lift min (s)').onChange(physicsChanged)
fk.add(kin, 'liftMax', 0.2, 1, 0.01).name('lift max (s)').onChange(physicsChanged)
fk.close()

const fl = gui.addFolder('Look')
fl.add(look, 'exposure', 0.3, 2.5, 0.01).onChange(applyLook)
fl.add(look, 'environment', 0, 2, 0.01).name('studio reflections').onChange(applyLook)
fl.add(look, 'key', 0, 8, 0.05).name('key light').onChange(applyLook)
fl.add(look, 'rim', 0, 4, 0.05).name('rim light').onChange(applyLook)
fl.add(look, 'paperTone', 0.3, 3, 0.01).name('paper tone').onChange(applyLook)
fl.add(look, 'occlusion', 0, 1, 0.01).name('contact occlusion').onChange(applyLook)
fl.addColor(look, 'base').name('paint base').onChange(applyLook)
fl.addColor(look, 'shadowTint').name('paint shadow tint').onChange(applyLook)
fl.addColor(look, 'highlightTint').name('paint highlight tint').onChange(applyLook)
fl.add(look, 'roughness', 0.05, 0.8, 0.01).name('paint roughness').onChange(applyLook)
fl.add(look, 'clearcoat', 0, 1, 0.01).name('wet clearcoat').onChange(applyLook)
fl.add(look, 'striations', 0, 3, 0.05).name('nozzle striations').onChange(applyLook)
fl.add(look, 'pits', 0, 3, 0.05).name('air pits').onChange(applyLook)
fl.add(look, 'pitch', 0, 70, 0.5).name('camera pitch (°)').onChange(applyLook)
fl.add(look, 'yaw', -40, 40, 0.5).name('camera yaw (°)').onChange(applyLook)
fl.add(look, 'roll', -5, 5, 0.1).name('camera roll (°)').onChange(applyLook)
fl.add(look, 'fov', 12, 50, 0.5).name('field of view (°)').onChange(applyLook)
fl.add(look, 'frame', 20, 700, 1).name('framed width (mm)').onChange(applyLook)
fl.add(look, 'targetX', -220, 220, 1).name('look at x (mm)').onChange(applyLook)
fl.add(look, 'targetZ', -60, 60, 1).name('look at z (mm)').onChange(applyLook)
fl.close()

gui.add(
  {
    copy: () => {
      const json = JSON.stringify({ kin, phys, look }, null, 2)
      navigator.clipboard?.writeText(json).catch(() => console.log(json))
    },
  },
  'copy',
).name('Copy preset JSON')
gui.add(
  {
    reset: () => {
      Object.assign(phys, defaultPhysics)
      try {
        localStorage.removeItem(PRESET_KEY)
      } catch {
        /* ignore */
      }
      gui.controllersRecursive().forEach((c) => c.updateDisplay())
      restart()
    },
  },
  'reset',
).name('Reset physics')
if (innerWidth < 700) gui.close()

build()
if (!view.playing) sim.advanceTo(sim.endTime)
setPlaying(view.playing)
renderStatus()
requestAnimationFrame(frame)

// Hooks for automated screenshots.
;(window as unknown as { lab: object }).lab = {
  seek: (t: number) => {
    restart(t)
    setPlaying(false)
  },
  ready: () => true,
  look: (o: Partial<typeof look>) => {
    Object.assign(look, o)
    applyLook()
  },
  get time() {
    return sim.t
  },
}
