/**
 * Home page orchestration.
 *
 *  intro       paper fades up, the tube writes the name (simulation in real time)
 *  transition  camera and name glide so the name lands top-centre at nav size; the paper
 *              dims, the content fades in (one reveal)
 *  final       static scene, rendered on demand (resize, hover light sweep)
 *
 * Skipping (button, any key, click, scroll, touch), repeat visits and reduced motion all go
 * straight to the final state using the baked height field. Clicking the name at home
 * replays the intro. The canvas is decoration; the link over the name is the interface.
 */
import { gsap } from 'gsap'
import nycd from '../lettering/NothingYouCouldDo.strokes.json'
import type { StrokeSet } from '../lettering/types'
import { presetKey, siteKinematics, sitePhysics } from '../physics/preset'
import type { CameraPose } from '../scene/stage'
import { createWorld, type World } from '../scene/world'
import bakeUrl from '../assets/bake/nycd.bin.gz?url'
import * as THREE from 'three/webgpu'

const SEEN_KEY = 'site.intro-seen.v1'
const set = nycd as StrokeSet
const key = presetKey(siteKinematics, sitePhysics, 'nycd')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const body = document.body
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const home = document.querySelector<HTMLAnchorElement>('#home')!
const skipBtn = document.querySelector<HTMLButtonElement>('#skip')!
const content = document.querySelector<HTMLElement>('#content')!

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* storage unavailable: the intro just plays again next time */
    }
  },
}

type Phase = 'intro' | 'transition' | 'final'
let phase: Phase = 'intro'
let world: World

// ---------------------------------------------------------------- boot
try {
  world = await createWorld({ canvas })
} catch (err) {
  console.warn('3D unavailable, showing the static page', err)
  staticFallback()
  throw err
}
world.load(set, siteKinematics, sitePhysics)
const bakeBytes: Promise<Uint8Array | null> = fetch(bakeUrl)
  .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
  .then((b) => new Uint8Array(b))
  .catch(() => null)

const introPose: CameraPose = { ...world.stage.pose, target: world.stage.pose.target.clone() }
const pose: CameraPose = { ...introPose, target: introPose.target.clone() }

/** Where the camera must be for the name to sit top-centre at nav size. */
function navPose(): CameraPose {
  const W = innerWidth
  const H = innerHeight
  const navW = Math.min(380, Math.max(200, W * 0.3))
  const pitch = 16
  const nameH = navW * (48 / 400) * Math.cos(THREE.MathUtils.degToRad(pitch))
  const top = 24
  return {
    pitch,
    yaw: 0,
    roll: 0,
    fov: 24,
    frameWidth: (0.41 * W) / navW,
    target: new THREE.Vector3(0, 0, 0),
    screenY: (top + nameH / 2) / H,
  }
}

function blendPose(a: CameraPose, b: CameraPose, t: number) {
  pose.pitch = a.pitch + (b.pitch - a.pitch) * t
  pose.yaw = a.yaw + (b.yaw - a.yaw) * t
  pose.roll = a.roll + (b.roll - a.roll) * t
  pose.fov = a.fov + (b.fov - a.fov) * t
  // Interpolate the framed width geometrically so the zoom feels even.
  pose.frameWidth = a.frameWidth * Math.pow(b.frameWidth / a.frameWidth, t)
  pose.target.lerpVectors(a.target, b.target, t)
  pose.screenY = a.screenY + (b.screenY - a.screenY) * t
  world.stage.placeCamera(pose)
}

/** Place the link exactly over the rendered name and reserve the nav band for it. */
const corners = [-0.205, 0.205].flatMap((x) => [-0.026, 0.026].flatMap((z) => [0, 0.007].map((y) => new THREE.Vector3(x, y, z))))
function placeLink() {
  const cam = world.camera
  cam.updateMatrixWorld()
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const v = new THREE.Vector3()
  for (const c of corners) {
    v.copy(c).project(cam)
    const x = ((v.x + 1) / 2) * innerWidth
    const y = ((1 - v.y) / 2) * innerHeight
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  Object.assign(home.style, { left: `${x0 - 8}px`, top: `${y0 - 6}px`, width: `${x1 - x0 + 16}px`, height: `${y1 - y0 + 12}px`, transform: 'none' })
  document.documentElement.style.setProperty('--nav-h', `${Math.round(y1 + 18)}px`)
}

// ---------------------------------------------------------------- loop
let needsRender = true
let last = performance.now()
let acc = 0
const requestRender = () => {
  needsRender = true
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (phase === 'intro') {
    const sim = world.sim
    acc += dt
    let n = 0
    while (acc >= sim.dt && n < 48) {
      sim.step()
      acc -= sim.dt
      n++
    }
    if (n === 48) acc = 0
    world.sync(dt)
    if (sim.t >= sim.endTime) beginTransition()
    needsRender = true
    world.adapt(dt * 1000)
  } else if (phase === 'transition') {
    world.sync(dt)
    needsRender = true
  }
  if (needsRender) {
    world.render()
    needsRender = false
  }
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- phases
const look = { mix: 0 }

function startIntro() {
  phase = 'intro'
  body.classList.add('is-intro')
  skipBtn.hidden = false
  gsap.killTweensOf([look, world.post.uniforms.fade, content])
  look.mix = 0
  blendPose(introPose, navPose(), 0)
  world.paper.uniforms.dim.value = 0
  world.post.uniforms.tiltShift.value = 1
  world.post.uniforms.fade.value = 0
  gsap.to(world.post.uniforms.fade, { value: 1, duration: 0.8, ease: 'power1.out' })
  gsap.set(content, { autoAlpha: 0, y: 14 })
  acc = 0
  addSkipListeners()
}

function beginTransition() {
  if (phase !== 'intro') return
  phase = 'transition'
  removeSkipListeners()
  const tl = gsap.timeline({ onComplete: finish })
  tl.to(look, { mix: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: () => blendPose(introPose, navPose(), look.mix) }, 0)
  tl.to(world.paper.uniforms.dim, { value: 1, duration: 1.4, ease: 'power1.inOut' }, 0.1)
  tl.to(world.post.uniforms.tiltShift, { value: 0, duration: 1.2, ease: 'power1.inOut' }, 0)
  tl.add(() => body.classList.remove('is-intro'), 0.9)
  tl.to(content, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.95)
}

function finish() {
  phase = 'final'
  body.classList.remove('is-intro')
  store.set(SEEN_KEY, '1')
  blendPose(introPose, navPose(), 1)
  placeLink()
  requestRender()
}

/** Jump to the settled final state (skip, repeat visit, reduced motion). */
async function goFinal(fadeIn: boolean) {
  removeSkipListeners()
  phase = 'transition'
  gsap.killTweensOf([look, world.post.uniforms.fade, world.paper.uniforms.dim, world.post.uniforms.tiltShift, content])
  const bytes = await bakeBytes
  const ok = bytes ? await world.applyBake(bytes, key) : false
  if (!ok) world.sim.advanceTo(world.sim.endTime) // no bake: simulate (slower, same result)
  world.sync(0)
  look.mix = 1
  world.paper.uniforms.dim.value = 1
  world.post.uniforms.tiltShift.value = 0
  finish()
  gsap.set(content, { autoAlpha: 1, y: 0 })
  if (fadeIn && !reduceMotion) {
    world.post.uniforms.fade.value = 0
    gsap.to(world.post.uniforms.fade, { value: 1, duration: 0.35, ease: 'power1.out', onUpdate: requestRender })
    gsap.from(content, { autoAlpha: 0, duration: 0.35 })
  } else {
    world.post.uniforms.fade.value = 1
  }
  requestRender()
}

// ---------------------------------------------------------------- input
const skip = (e?: Event) => {
  if (phase !== 'intro') return
  if (e instanceof KeyboardEvent && (e.key === 'Tab' || e.key === 'Shift')) return // let people reach the button
  void goFinal(true)
}
const skipEvents: [EventTarget, string][] = [
  [skipBtn, 'click'],
  [window, 'keydown'],
  [window, 'wheel'],
  [window, 'touchstart'],
  [canvas, 'pointerdown'],
]
function addSkipListeners() {
  for (const [t, ev] of skipEvents) t.addEventListener(ev, skip, { passive: true })
}
function removeSkipListeners() {
  for (const [t, ev] of skipEvents) t.removeEventListener(ev, skip)
}

home.addEventListener('click', (e) => {
  // At home, the name replays the intro instead of reloading the page.
  // (This is the only page for now; on other pages the link simply navigates home.)
  {
    e.preventDefault()
    if (phase !== 'final') return
    gsap.to(content, {
      autoAlpha: 0,
      duration: 0.3,
      onComplete: () => {
        world.load(set, siteKinematics, sitePhysics)
        startIntro()
      },
    })
  }
})

// Hover / focus: the key highlight glides along the letters.
const gloss = { y: 0 }
const sweep = (to: number) =>
  gsap.to(gloss, {
    y: to,
    duration: 0.9,
    ease: 'sine.inOut',
    onUpdate: () => {
      world.setGlossRotation(gloss.y)
      requestRender()
    },
  })
home.addEventListener('pointerenter', () => phase === 'final' && sweep(0.55))
home.addEventListener('pointerleave', () => phase === 'final' && sweep(0))
home.addEventListener('focus', () => phase === 'final' && sweep(0.55))
home.addEventListener('blur', () => phase === 'final' && sweep(0))

window.addEventListener('resize', () => {
  world.resize()
  if (phase === 'final') {
    blendPose(introPose, navPose(), 1)
    placeLink()
  } else {
    blendPose(introPose, navPose(), look.mix)
  }
  requestRender()
})

function staticFallback() {
  body.classList.remove('is-intro')
  canvas.hidden = true
  skipBtn.hidden = true
  const img = document.querySelector<HTMLImageElement>('#fallback-name')!
  img.src = '/name-fallback.png'
  img.hidden = false
  document.documentElement.style.setProperty('--nav-h', '110px')
}

// ---------------------------------------------------------------- go
;(window as unknown as { site: object }).site = {
  get phase() {
    return phase
  },
  get time() {
    return world.sim.t
  },
  skip: () => goFinal(false),
}

const seen = store.get(SEEN_KEY) === '1'
if (reduceMotion || seen || new URLSearchParams(location.search).has('final')) {
  void goFinal(!reduceMotion)
} else {
  startIntro()
}
requestAnimationFrame(frame)
