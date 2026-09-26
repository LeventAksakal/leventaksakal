/**
 * Milestone 1 lab: plays the traced strokes as a plain 2D line with the planned
 * stroke order, pen lifts and speed profile. Debug controls tune every kinematic
 * parameter; presets persist per browser.
 */
import GUI from 'lil-gui'
import damion from '../lettering/Damion.strokes.json'
import type { StrokeSet } from '../lettering/types'
import {
  defaultKinematics,
  planWriting,
  sampleNozzle,
  type KinematicsParams,
  type WritingPlan,
} from '../physics/kinematics'

const strokes = damion as StrokeSet
const PRESET_KEY = 'lab.strokes.preset.v1'
const LEAD_IN = 0.4 // s shown before first touchdown
const LEAD_OUT = 0.8 // s held after final lift-off

const view = {
  widthMode: 'bead width' as 'plain line' | 'bead width',
  speedColour: false,
  ghost: true,
  orderLabels: true,
  playbackRate: 1,
  loop: true,
}

const params: KinematicsParams = { ...defaultKinematics, ...loadPreset() }

function loadPreset(): Partial<KinematicsParams> {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    return raw ? (JSON.parse(raw) as Partial<KinematicsParams>) : {}
  } catch {
    return {}
  }
}
function savePreset() {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(params))
  } catch {
    /* storage unavailable: presets just don't persist */
  }
}

let plan: WritingPlan = planWriting(strokes, params)

// ---------------------------------------------------------------- layout
const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const speedCanvas = document.querySelector<HTMLCanvasElement>('#speed')!
const playBtn = document.querySelector<HTMLButtonElement>('#play')!
const scrub = document.querySelector<HTMLInputElement>('#scrub')!
const clock = document.querySelector<HTMLOutputElement>('#clock')!
const statsEl = document.querySelector<HTMLDListElement>('#stats')!
const DPR = Math.min(2, window.devicePixelRatio || 1)

const css = getComputedStyle(document.documentElement)
const colour = (name: string) => css.getPropertyValue(name).trim()
const C = {
  chalk: colour('--chalk'),
  smudge: colour('--smudge'),
  line: colour('--graphite-line'),
  cadmium: colour('--cadmium'),
  deep: colour('--cadmium-deep'),
  pale: colour('--cadmium-pale'),
}

function fit(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect()
  canvas.width = Math.round(r.width * DPR)
  canvas.height = Math.round(r.height * DPR)
}

// mm -> canvas px, fitted with a margin, name centred.
function paperTransform(canvas: HTMLCanvasElement) {
  const [w, h] = strokes.size
  const margin = 0.08
  const sx = (canvas.width * (1 - 2 * margin)) / w
  const sy = (canvas.height * (1 - 2 * margin)) / (h + params.liftHeight * 0.5)
  const s = Math.min(sx, sy)
  const ox = (canvas.width - w * s) / 2
  const oy = (canvas.height - h * s) / 2 + params.liftHeight * 0.18 * s
  return { s, ox, oy }
}

// ---------------------------------------------------------------- drawing
function speedToColour(u: number, lo: number, hi: number) {
  const f = Math.min(1, Math.max(0, (u - lo) / (hi - lo)))
  // slow = deep orange, fast = pale yellow
  const a = [217, 115, 13]
  const b = [247, 230, 160]
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`
}

function drawStage(t: number) {
  const ctx = stage.getContext('2d')!
  const { s, ox, oy } = paperTransform(stage)
  const X = (x: number) => ox + x * s
  const Y = (y: number) => oy + y * s
  ctx.clearRect(0, 0, stage.width, stage.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (view.ghost) {
    ctx.strokeStyle = 'rgba(230,225,216,0.07)'
    ctx.lineWidth = strokes.fontStrokeWidthMm * s
    for (const st of plan.strokes) {
      ctx.beginPath()
      st.x.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(st.y[i])) : ctx.moveTo(X(x), Y(st.y[i]))))
      ctx.stroke()
    }
  }

  const uLo = plan.medianSpeed * 0.35
  const uHi = plan.medianSpeed * 1.5
  const beadPx = params.beadWidth * s
  for (const st of plan.strokes) {
    if (t < st.t[0]) break
    let n = st.t.length
    if (t < st.t[n - 1]) {
      let lo = 0
      let hi = n - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (st.t[mid] <= t) lo = mid
        else hi = mid - 1
      }
      n = lo + 1
    }
    if (view.widthMode === 'plain line' && !view.speedColour) {
      ctx.strokeStyle = C.cadmium
      ctx.lineWidth = Math.max(1.5 * DPR, beadPx * 0.35)
      ctx.beginPath()
      for (let i = 0; i < n; i++) (i ? ctx.lineTo(X(st.x[i]), Y(st.y[i])) : ctx.moveTo(X(st.x[i]), Y(st.y[i])))
      ctx.stroke()
      continue
    }
    for (let i = 1; i < n; i++) {
      const w =
        view.widthMode === 'bead width'
          ? beadPx * Math.sqrt(st.area[i] / plan.nominalArea)
          : Math.max(1.5 * DPR, beadPx * 0.35)
      ctx.lineWidth = w
      ctx.strokeStyle = view.speedColour ? speedToColour(st.U[i], uLo, uHi) : C.cadmium
      ctx.beginPath()
      ctx.moveTo(X(st.x[i - 1]), Y(st.y[i - 1]))
      ctx.lineTo(X(st.x[i]), Y(st.y[i]))
      ctx.stroke()
    }
  }

  if (view.orderLabels) {
    ctx.font = `${11 * DPR}px ${getComputedStyle(document.body).fontFamily}`
    ctx.textBaseline = 'bottom'
    plan.strokes.forEach((st, i) => {
      const done = t >= st.t[0]
      ctx.fillStyle = done ? C.smudge : 'rgba(139,137,131,0.45)'
      ctx.fillText(`${i + 1}${st.delayed ? '′' : ''}`, X(st.x[0]) + 5 * DPR, Y(st.y[0]) - 4 * DPR)
    })
  }

  // Nozzle: its shadow on the paper and the tip lifted by z (drawn as an offset "up" the screen).
  const nz = sampleNozzle(plan, t, params)
  if (nz.phase !== 'before' && nz.phase !== 'after') {
    const lift = (nz.z - params.nozzleHeight) / (params.liftHeight - params.nozzleHeight)
    ctx.fillStyle = `rgba(0,0,0,${0.55 - 0.35 * lift})`
    ctx.beginPath()
    ctx.ellipse(X(nz.x) + nz.z * s * 0.25, Y(nz.y) + nz.z * s * 0.1, (3 + 4 * lift) * s * 0.5, (2 + 3 * lift) * s * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    const tipX = X(nz.x)
    const tipY = Y(nz.y) - nz.z * s * 0.35
    ctx.strokeStyle = C.chalk
    ctx.lineWidth = 1.5 * DPR
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX + 10 * s, tipY - 22 * s)
    ctx.stroke()
    ctx.fillStyle = nz.phase === 'lift' ? C.smudge : C.chalk
    ctx.beginPath()
    ctx.arc(tipX, tipY, 2.4 * DPR, 0, Math.PI * 2)
    ctx.fill()
    if (nz.phase === 'dwell') {
      ctx.strokeStyle = C.pale
      ctx.lineWidth = 1 * DPR
      ctx.beginPath()
      ctx.arc(X(nz.x), Y(nz.y), (4 + 3 * ((t * 3) % 1)) * s * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function drawSpeedChart(t: number) {
  const ctx = speedCanvas.getContext('2d')!
  const W = speedCanvas.width
  const H = speedCanvas.height
  const pad = { l: 44 * DPR, r: 10 * DPR, t: 8 * DPR, b: 22 * DPR }
  const t0 = -LEAD_IN
  const t1 = plan.tEnd + LEAD_OUT
  let uMax = 0
  for (const st of plan.strokes) for (const u of st.U) uMax = Math.max(uMax, u)
  const step = niceStep(uMax / 4)
  const yMax = Math.ceil(uMax / step) * step
  const X = (tt: number) => pad.l + ((tt - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const Y = (u: number) => H - pad.b - (u / yMax) * (H - pad.t - pad.b)
  ctx.clearRect(0, 0, W, H)
  ctx.font = `${10.5 * DPR}px ${getComputedStyle(document.body).fontFamily}`

  ctx.fillStyle = 'rgba(139,137,131,0.12)'
  for (const l of plan.lifts) ctx.fillRect(X(l.t0), pad.t, X(l.t1) - X(l.t0), H - pad.t - pad.b)
  ctx.fillStyle = 'rgba(242,183,5,0.08)'
  ctx.fillRect(X(0), pad.t, X(params.startDwell) - X(0), H - pad.t - pad.b)

  ctx.strokeStyle = C.line
  ctx.fillStyle = C.smudge
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let u = 0; u <= yMax + 1e-6; u += step) {
    ctx.beginPath()
    ctx.moveTo(pad.l, Y(u))
    ctx.lineTo(W - pad.r, Y(u))
    ctx.stroke()
    ctx.fillText(`${Math.round(u)}`, pad.l - 6 * DPR, Y(u))
  }
  ctx.save()
  ctx.translate(11 * DPR, (pad.t + H - pad.b) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillText('mm/s', 0, 0)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let s = 0; s <= t1; s += 2) ctx.fillText(`${s} s`, X(s), H - pad.b + 5 * DPR)

  for (const st of plan.strokes) {
    ctx.beginPath()
    for (let i = 0; i < st.t.length; i += 2) (i ? ctx.lineTo(X(st.t[i]), Y(st.U[i])) : ctx.moveTo(X(st.t[i]), Y(st.U[i])))
    ctx.lineTo(X(st.t[st.t.length - 1]), Y(0))
    ctx.lineTo(X(st.t[0]), Y(0))
    ctx.closePath()
    ctx.fillStyle = 'rgba(242,183,5,0.13)'
    ctx.fill()
    ctx.beginPath()
    for (let i = 0; i < st.t.length; i += 2) (i ? ctx.lineTo(X(st.t[i]), Y(st.U[i])) : ctx.moveTo(X(st.t[i]), Y(st.U[i])))
    ctx.strokeStyle = C.cadmium
    ctx.lineWidth = 1.5 * DPR
    ctx.stroke()
  }

  ctx.strokeStyle = C.chalk
  ctx.lineWidth = 1 * DPR
  ctx.beginPath()
  ctx.moveTo(X(t), pad.t)
  ctx.lineTo(X(t), H - pad.b)
  ctx.stroke()
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p
  return 10 * p
}

function renderStats() {
  let uMax = 0
  let uMin = Infinity
  for (const st of plan.strokes)
    for (const u of st.U) {
      uMax = Math.max(uMax, u)
      uMin = Math.min(uMin, u)
    }
  const liftTime = plan.lifts.reduce((a, l) => a + (l.t1 - l.t0), 0)
  const rows: [string, string][] = [
    ['Drawing phase', `${plan.tEnd.toFixed(2)} s`],
    ['Pen lifts', `${plan.lifts.length} · ${liftTime.toFixed(2)} s`],
    ['Path length', `${(plan.totalLength / 10).toFixed(1)} cm`],
    ['Median speed U₀', `${plan.medianSpeed.toFixed(0)} mm/s`],
    ['Speed range', `${uMin.toFixed(0)}–${uMax.toFixed(0)} mm/s`],
    ['Name size', `${strokes.size[0].toFixed(0)} × ${strokes.size[1].toFixed(0)} mm`],
  ]
  statsEl.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
}

// ---------------------------------------------------------------- clock
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let playing = !reduceMotion
let t = reduceMotion ? plan.tEnd + LEAD_OUT : -LEAD_IN
let last = performance.now()

function setPlaying(v: boolean) {
  playing = v
  playBtn.textContent = v ? 'Pause' : 'Play'
  playBtn.setAttribute('aria-label', v ? 'Pause' : 'Play')
  if (v && t >= plan.tEnd + LEAD_OUT) t = -LEAD_IN
}
playBtn.addEventListener('click', () => setPlaying(!playing))
scrub.addEventListener('input', () => {
  setPlaying(false)
  t = -LEAD_IN + (Number(scrub.value) / 1000) * (plan.tEnd + LEAD_OUT + LEAD_IN)
})
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    setPlaying(!playing)
  }
})

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  const span = plan.tEnd + LEAD_OUT + LEAD_IN
  if (playing) {
    t += dt * view.playbackRate
    if (t > plan.tEnd + LEAD_OUT) {
      if (view.loop) t = -LEAD_IN
      else {
        t = plan.tEnd + LEAD_OUT
        setPlaying(false)
      }
    }
    scrub.value = String(Math.round(((t + LEAD_IN) / span) * 1000))
  }
  clock.textContent = `${Math.max(0, t).toFixed(2)} s`
  drawStage(t)
  drawSpeedChart(t)
  requestAnimationFrame(frame)
}

function resize() {
  fit(stage)
  fit(speedCanvas)
}
window.addEventListener('resize', resize)
resize()
renderStats()
requestAnimationFrame(frame)

// ---------------------------------------------------------------- controls
function replan() {
  plan = planWriting(strokes, params)
  renderStats()
  savePreset()
}
const gui = new GUI({ title: 'Kinematics', container: document.querySelector<HTMLElement>('#controls')! })
const fk = gui.addFolder('Timing')
fk.add(params, 'drawDuration', 8, 15, 0.1).name('drawing phase (s)').onChange(replan)
fk.add(params, 'startDwell', 0, 1.2, 0.05).name('first-touch dwell (s)').onChange(replan)
fk.add(params, 'liftMin', 0.15, 0.8, 0.01).name('lift min (s)').onChange(replan)
fk.add(params, 'liftMax', 0.2, 1, 0.01).name('lift max (s)').onChange(replan)
const fs = gui.addFolder('Speed profile')
fs.add(params, 'powerLawBeta', 0, 0.6, 0.01).name('power-law β').onChange(replan)
fs.add(params, 'radiusMin', 0.2, 10, 0.1).name('R min (mm)').onChange(replan)
fs.add(params, 'radiusMax', 10, 400, 1).name('R max (mm)').onChange(replan)
fs.add(params, 'curvatureSmoothing', 0, 6, 0.1).name('κ smoothing (mm)').onChange(replan)
fs.add(params, 'speedSmoothing', 0, 12, 0.1).name('U smoothing (mm)').onChange(replan)
fs.add(params, 'easeInLength', 0, 30, 0.5).name('ease-in (mm)').onChange(replan)
fs.add(params, 'easeOutLength', 0, 30, 0.5).name('ease-out (mm)').onChange(replan)
fs.add(params, 'easeFloor', 0.02, 1, 0.01).name('ease floor').onChange(replan)
const fd = gui.addFolder('Deposition preview')
fd.add(params, 'beadWidth', 2, 8, 0.1).name('bead width (mm)').onChange(replan)
fd.add(params, 'flowExponent', 0, 1, 0.01).name('flow exponent φ').onChange(replan)
fd.add(params, 'areaRatioMin', 0.2, 1, 0.01).name('A/A₀ min').onChange(replan)
fd.add(params, 'areaRatioMax', 1, 4, 0.05).name('A/A₀ max').onChange(replan)
const fv = gui.addFolder('View')
fv.add(view, 'widthMode', ['plain line', 'bead width']).name('line')
fv.add(view, 'speedColour').name('colour by speed')
fv.add(view, 'ghost').name('show font ghost')
fv.add(view, 'orderLabels').name('stroke numbers')
fv.add(view, 'playbackRate', 0.1, 2, 0.05).name('playback rate')
fv.add(view, 'loop')
gui.add(
  {
    copy: () => {
      const json = JSON.stringify(params, null, 2)
      navigator.clipboard?.writeText(json).catch(() => console.log(json))
    },
  },
  'copy',
).name('Copy preset JSON')
gui.add(
  {
    reset: () => {
      Object.assign(params, defaultKinematics)
      gui.controllersRecursive().forEach((c) => c.updateDisplay())
      replan()
    },
  },
  'reset',
).name('Reset to defaults')
if (window.innerWidth < 900) gui.close()

// ---------------------------------------------------------------- font list
const fonts = [
  {
    family: 'Damion',
    bead: 5.7,
    traced: true,
    note: 'Letters join, so “Levent” is one stroke. Open counters survive a thick bead. Retraces on v, a and k, as in real cursive.',
  },
  {
    family: 'Yellowtail',
    bead: 5.4,
    note: 'Right weight and a sign-painter feel, but most letters are separate glyphs that only touch: about 8 extra pen lifts.',
  },
  {
    family: 'Mr Dafoe',
    bead: 5.0,
    note: 'Most energy. Letters overlap heavily; the A and k collide, which paste would merge into a blob.',
  },
  {
    family: 'Homemade Apple',
    bead: 3.1,
    note: 'Most like real handwriting and monoline. Very wide, so each letter is small at 400 mm; the L reads as an S.',
  },
  {
    family: 'Sacramento',
    bead: 2.6,
    note: 'Elegant hairline. Below the 3–5 mm bead target; its tiny e and s loops would fill in with paste.',
  },
]
document.querySelector('#font-list')!.innerHTML = fonts
  .map(
    (f) => `<li class="${f.traced ? 'traced' : ''}">
      <div class="specimen" style="font-family:'Lab ${f.family}', cursive">Levent Aksakal</div>
      <div class="meta"><b>${f.family}${f.traced ? '<span class="tag">traced</span>' : ''}</b>
      <span class="figure">bead at 400 mm: ${f.bead.toFixed(1)} mm</span><p>${f.note}</p></div></li>`,
  )
  .join('')
