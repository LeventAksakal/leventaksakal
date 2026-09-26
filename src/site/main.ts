/**
 * Home page orchestration.
 *
 *  intro       paper fades up, the tube writes the name (simulation in real time)
 *  transition  camera and name glide so the name lands top-centre at nav size; the desk
 *              statement and label rise in (one reveal)
 *  final       static scene, rendered only on demand (resize, hover on the name); the render
 *              loop stops when idle. Scrolling never touches WebGL: a CSS overlay dims the
 *              paper under the content (opacity only, composited)
 *
 * During the intro a click or tap fast-forwards; a second one skips to the end (so does
 * Escape, scrolling, or the keyboard skip link). Skips, repeat visits and reduced motion use
 * the baked height field. Clicking the name at home replays the intro.
 */
import { gsap } from 'gsap'
import * as THREE from 'three/webgpu'
import bakeUrl from '../assets/bake/nycd.bin.gz?url'
import nycd from '../lettering/NothingYouCouldDo.strokes.json'
import type { StrokeSet } from '../lettering/types'
import { presetKey, siteKinematics, sitePhysics } from '../physics/preset'
import type { CameraPose } from '../scene/stage'
import { createWorld, type World } from '../scene/world'

const SEEN_KEY = 'site.intro-seen.v1'
const FAST = 5 // fast-forward rate
const set = nycd as StrokeSet
const key = presetKey(siteKinematics, sitePhysics, 'nycd')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const params = new URLSearchParams(location.search)

const body = document.body
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
const home = document.querySelector<HTMLAnchorElement>('#home')!
const hint = document.querySelector<HTMLParagraphElement>('#hint')!
const skipLink = document.querySelector<HTMLAnchorElement>('#skip-link')!
const main = document.querySelector<HTMLElement>('#main')!
const dimLayer = document.querySelector<HTMLElement>('#dim')!
const lines = [...document.querySelectorAll<HTMLElement>('.desk .lead')]
const deskExtras = [...document.querySelectorAll<HTMLElement>('.desk .cue')]

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
  world = await createWorld({ canvas, forceWebGL: params.has('webgl'), worker: !params.has('capture') && !params.has('noworker') })
} catch (err) {
  console.warn('3D unavailable, showing the static page', err)
  staticFallback()
  throw err
}
world.load(set, siteKinematics, sitePhysics)
// Build every shader now (screen still black), not in the middle of the intro.
await world.warmUp()
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
  const navW = Math.min(360, Math.max(190, W * 0.28))
  const pitch = 16
  const nameH = navW * (48 / 400) * Math.cos(THREE.MathUtils.degToRad(pitch))
  const top = 26
  return { pitch, yaw: 0, roll: 0, fov: 24, frameWidth: (0.41 * W) / navW, target: new THREE.Vector3(0, 0, 0), screenY: (top + nameH / 2) / H }
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
  Object.assign(home.style, { left: `${x0 - 10}px`, top: `${y0 - 8}px`, width: `${x1 - x0 + 20}px`, height: `${y1 - y0 + 16}px`, translate: 'none' })
  document.documentElement.style.setProperty('--nav-h', `${Math.round(y1 + 22)}px`)
}

// ---------------------------------------------------------------- loop
let needsRender = true
let looping = false
let last = performance.now()
let rate = 1
/** Start the frame loop if it has stopped (it stops by itself once the page is static). */
function kick() {
  if (looping) return
  looping = true
  last = performance.now()
  requestAnimationFrame(frame)
}
const requestRender = () => {
  needsRender = true
  kick()
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (phase === 'intro') {
    world.advance(dt * rate, 48 * rate)
    world.sync(dt * rate)
    if (world.sim.t >= world.sim.endTime) beginTransition()
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
  if (phase === 'final') {
    looping = false // nothing moves: sleep until the next requestRender()
    return
  }
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- scroll → dim overlay
const desk = { dim: 0.22 } // paper dimming on the first screen (in the scene)
let scrollQueued = false
function applyScroll() {
  scrollQueued = false
  const p = Math.min(1, main.scrollTop / Math.max(1, main.clientHeight * 0.8))
  dimLayer.style.opacity = (p * 0.45).toFixed(3)
}
main.addEventListener(
  'scroll',
  () => {
    if (phase !== 'final' || scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(applyScroll)
  },
  { passive: true },
)

// ---------------------------------------------------------------- phases
const look = { mix: 0 }
let hintTimer = 0

function setHint(text: string) {
  hint.textContent = text
  hint.classList.toggle('is-on', !!text)
}

function startIntro() {
  phase = 'intro'
  rate = 1
  body.classList.add('is-intro')
  gsap.killTweensOf([look, world.post.uniforms.fade, main, ...lines, ...deskExtras])
  look.mix = 0
  blendPose(introPose, navPose(), 0)
  world.paper.uniforms.dim.value = 0
  world.post.uniforms.tiltShift.value = 1
  world.post.uniforms.fade.value = 0
  gsap.to(world.post.uniforms.fade, { value: 1, duration: 0.8, ease: 'power1.out' })
  main.scrollTop = 0
  dimLayer.style.opacity = '0'
  gsap.set(main, { autoAlpha: 0 })
  setHint('')
  clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => phase === 'intro' && setHint('Click to fast-forward'), 1600)
  addIntroListeners()
}

function beginTransition() {
  if (phase !== 'intro') return
  phase = 'transition'
  rate = 1
  removeIntroListeners()
  setHint('')
  const tl = gsap.timeline({ onComplete: finish })
  tl.to(look, { mix: 1, duration: 1.7, ease: 'power2.inOut', onUpdate: () => blendPose(introPose, navPose(), look.mix) }, 0)
  tl.to(world.paper.uniforms.dim, { value: desk.dim, duration: 1.4, ease: 'power1.inOut' }, 0.2)
  tl.to(world.post.uniforms.tiltShift, { value: 0, duration: 1.2, ease: 'power1.inOut' }, 0)
  tl.add(() => {
    body.classList.remove('is-intro')
    placeLink()
    gsap.set(main, { autoAlpha: 1 })
  }, 1.1)
  tl.fromTo(lines, { autoAlpha: 0, y: 42 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out' }, 1.15)
  tl.fromTo(deskExtras, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.12, ease: 'power1.out' }, 1.6)
}

function finish() {
  phase = 'final'
  body.classList.remove('is-intro')
  store.set(SEEN_KEY, '1')
  blendPose(introPose, navPose(), 1)
  placeLink()
  applyScroll()
  requestRender()
}

/** Jump to the settled final state (skip, repeat visit, reduced motion). */
async function goFinal(fadeIn: boolean) {
  removeIntroListeners()
  phase = 'transition'
  rate = 1
  setHint('')
  gsap.killTweensOf([look, world.post.uniforms.fade, world.paper.uniforms.dim, world.post.uniforms.tiltShift, main, ...lines, ...deskExtras])
  world.halt()
  const bytes = await bakeBytes
  const ok = bytes ? await world.applyBake(bytes, key) : false
  if (!ok) {
    // No bake: simulate from scratch here (slower, same result).
    world.load(set, siteKinematics, sitePhysics, true)
    world.sim.advanceTo(world.sim.endTime)
  }
  world.sync(0)
  look.mix = 1
  world.post.uniforms.tiltShift.value = 0
  body.classList.remove('is-intro')
  gsap.set(main, { autoAlpha: 1 })
  gsap.set([...lines, ...deskExtras], { autoAlpha: 1, y: 0 })
  finish()
  if (fadeIn && !reduceMotion) {
    world.post.uniforms.fade.value = 0
    gsap.to(world.post.uniforms.fade, { value: 1, duration: 0.45, ease: 'power1.out', onUpdate: requestRender })
    gsap.from(lines, { autoAlpha: 0, y: 30, duration: 0.7, stagger: 0.07, ease: 'power3.out' })
    gsap.from(deskExtras, { autoAlpha: 0, duration: 0.6, delay: 0.25 })
  } else {
    world.post.uniforms.fade.value = 1
  }
  requestRender()
}

// ---------------------------------------------------------------- intro input
/** First click/tap/key: fast-forward. Second: skip to the end. */
function advance() {
  if (phase !== 'intro') return
  if (rate === 1) {
    rate = FAST
    setHint(`×${FAST} · click again to skip`)
  } else {
    void goFinal(true)
  }
}
const onPointer = (e: PointerEvent) => {
  if (e.button === 0) advance()
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') void goFinal(true)
  else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
    if (document.activeElement === skipLink) return
    e.preventDefault()
    advance()
  }
}
const onWheel = () => void goFinal(true)
const onSkipLink = (e: Event) => {
  e.preventDefault()
  void goFinal(false).then(() => main.focus())
}
function addIntroListeners() {
  window.addEventListener('pointerdown', onPointer)
  window.addEventListener('keydown', onKey)
  window.addEventListener('wheel', onWheel, { passive: true })
  skipLink.addEventListener('click', onSkipLink)
}
function removeIntroListeners() {
  window.removeEventListener('pointerdown', onPointer)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('wheel', onWheel)
  skipLink.removeEventListener('click', onSkipLink)
}

// ---------------------------------------------------------------- the name
home.addEventListener('click', (e) => {
  // This is the only page for now: at home the name replays the intro.
  e.preventDefault()
  if (phase !== 'final') return
  gsap.to(main, {
    autoAlpha: 0,
    duration: 0.3,
    onComplete: () => {
      world.load(set, siteKinematics, sitePhysics)
      startIntro()
      kick()
    },
  })
})

// Hover / focus: the studio highlight glides along the letters.
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
  const img = document.querySelector<HTMLImageElement>('#fallback-name')!
  img.src = '/name-fallback.png'
  img.hidden = false
  document.documentElement.style.setProperty('--nav-h', '104px')
}

// ---------------------------------------------------------------- go
;(window as unknown as { site: object }).site = {
  world,
  get phase() {
    return phase
  },
  get time() {
    return world.sim.t
  },
  skip: () => goFinal(false),
}

if (params.has('capture')) {
  // Deterministic frame capture for review: the caller advances time explicitly.
  startIntro()
  gsap.killTweensOf(world.post.uniforms.fade)
  world.post.uniforms.fade.value = 1
  setHint('')
  clearTimeout(hintTimer)
  removeIntroListeners()
  const follow = { on: false, width: 0.12 }
  Object.assign((window as unknown as { site: object }).site, {
    follow: (on: boolean, width = 0.12) => Object.assign(follow, { on, width }),
    step: (dt: number) => {
      const sim = world.sim
      const target = sim.t + dt
      while (sim.t + sim.dt <= target) sim.step()
      world.sync(dt)
      if (follow.on) {
        pose.frameWidth = follow.width
        pose.target.set(sim.tip.x, 0, sim.tip.z)
        world.stage.placeCamera(pose)
      }
      world.render()
      return sim.t
    },
  })
} else {
  const seen = store.get(SEEN_KEY) === '1'
  if (reduceMotion || seen || params.has('final')) void goFinal(!reduceMotion)
  else startIntro()
  kick()
}
