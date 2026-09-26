/**
 * Assembles the desk scene around a simulation: renderer + lights, baked paper, paste
 * surface, thread, paint tube and post. Shared by the lab and the site.
 *
 * Frame budget: the paper and pit detail are baked once; paste chunks upload only when
 * touched and stay hidden while empty; the shadow map updates only while something moves;
 * resolution adapts to the measured frame time; after the intro the caller renders on demand.
 */
import * as THREE from 'three/webgpu'
import type { StrokeSet } from '../lettering/types'
import { decodeBake, gunzip } from '../physics/bake'
import type { KinematicsParams } from '../physics/kinematics'
import type { PhysicsParams } from '../physics/params'
import { PasteSimulation, type SimSnapshot } from '../physics/simulation'
import { PaintTube } from './paintTube'
import { bakePaper, createPaper } from './paper'
import { bakeDetail, PasteSurface } from './paste'
import { createPost } from './post'
import { createStage, type Quality } from './stage'
import { ThreadMesh } from './threadMesh'

export interface WorldOptions {
  canvas: HTMLCanvasElement
  quality?: Quality
  forceWebGL?: boolean
  /** device-pixel-ratio ceiling */
  maxDpr?: number
  /** Run the simulation in a Web Worker (the page renders a mirror); else on the main thread. */
  worker?: boolean
}

/** s — the tube enters this long before first touch */
export const INTRO_LEAD = 0.9

export function pickQuality(): Quality {
  const q = new URLSearchParams(location.search).get('quality')
  if (q === 'high' || q === 'medium' || q === 'low') return q
  const small = Math.min(screen.width, screen.height) < 700
  const cores = navigator.hardwareConcurrency ?? 4
  if (small || cores <= 4) return 'medium'
  return 'high'
}

export async function createWorld(o: WorldOptions) {
  const quality = o.quality ?? pickQuality()
  const stage = await createStage({ canvas: o.canvas, forceWebGL: o.forceWebGL, quality })
  const { renderer, scene, camera } = stage
  const paperBake = bakePaper(renderer, quality === 'high' ? 4096 : quality === 'medium' ? 3072 : 2048)
  const detail = bakeDetail(renderer)
  const post = createPost(renderer, scene, camera, quality)

  const maxDpr = Math.min(o.maxDpr ?? 2, window.devicePixelRatio || 1)
  let dpr = Math.min(maxDpr, quality === 'high' ? 1.5 : 1.25)
  stage.resize(dpr)

  const tube = new PaintTube(stage.glossEnv)
  scene.add(tube.group)

  let sim!: PasteSimulation
  let paste!: PasteSurface
  let thread!: ThreadMesh
  let paper!: ReturnType<typeof createPaper>
  const threadMat = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.5, specularIntensity: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMap: stage.glossEnv, envMapIntensity: 1 })

  // Simulation driver: stepped here, or in a worker whose replies update the local mirror.
  const worker = o.worker && typeof Worker !== 'undefined' ? new Worker(new URL('../physics/sim.worker.ts', import.meta.url), { type: 'module' }) : null
  let gen = 0
  let inFlight = false
  let target = 0
  let acc = 0
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ gen: number; snap: SimSnapshot; capped: boolean }>) => {
      if (e.data.gen !== gen) return
      inFlight = false
      sim.applySnapshot(e.data.snap)
      if (e.data.capped) target = sim.t // too far behind: drop the backlog, like the local cap
    }
  }

  /** Advance simulated time by dt (s), at most maxSteps steps at once (excess time is dropped). */
  function advance(dt: number, maxSteps: number) {
    if (!worker) {
      acc += dt
      let n = 0
      while (acc >= sim.dt && n < maxSteps) {
        sim.step()
        acc -= sim.dt
        n++
      }
      if (n >= maxSteps) acc = 0
      return
    }
    target += dt
    if (!inFlight) {
      inFlight = true
      worker.postMessage({ type: 'advance', gen, target, maxSteps })
    }
  }

  /** Stop the running simulation (before jumping to a bake); late worker replies are ignored. */
  function halt() {
    gen++
    inFlight = false
    worker?.postMessage({ type: 'stop' })
  }

  function load(set: StrokeSet, kin: KinematicsParams, phys: PhysicsParams, local = false) {
    if (paste) {
      scene.remove(paste.group, thread.mesh, paper.mesh)
      paste.dispose()
    }
    sim = new PasteSimulation(set, kin, phys, -INTRO_LEAD)
    gen++
    inFlight = false
    acc = 0
    target = sim.t
    if (worker && !local) worker.postMessage({ type: 'init', gen, set, kin, phys, startTime: -INTRO_LEAD })
    else if (worker) worker.postMessage({ type: 'stop' })
    paste = new PasteSurface(sim.field, detail.texture, stage.glossEnv)
    const f = sim.field
    paper = createPaper({ bake: paperBake.texture, occlusion: paste.occlusion, fieldRect: { x0: f.x0, z0: f.z0, w: f.nx * f.dx, d: f.nz * f.dx } })
    thread = new ThreadMesh(sim.thread.n, threadMat)
    threadMat.color.copy(paste.uniforms.base.value)
    scene.add(paper.mesh, paste.group, thread.mesh)
    stage.key.shadow.needsUpdate = true
    return sim
  }

  /** Load a gzipped bake into the current simulation and jump to its settled end. */
  async function applyBake(gz: Uint8Array, key?: string): Promise<boolean> {
    const ok = decodeBake(await gunzip(gz), sim.field, key)
    if (!ok) return false
    sim.finishFromBake()
    paste.update()
    paste.updateOcclusion(true)
    thread.update(sim.thread)
    tube.group.visible = false
    stage.key.shadow.needsUpdate = true
    return true
  }

  const tip = new THREE.Vector3()
  const travel = new THREE.Vector2()
  const away = new THREE.Vector3(0.16, 0.11, -0.12)
  const projected = new THREE.Vector3()
  let occlusionClock = 0

  /** Push simulation state into the visuals. */
  function sync(dt: number) {
    const moving = paste.update()
    occlusionClock += dt
    if (occlusionClock > 0.12) {
      occlusionClock = 0
      paste.updateOcclusion()
    }
    thread.update(sim.thread)
    const t = sim.t
    const nz = sim.nozzle
    tip.set(sim.tip.x, sim.tip.y, sim.tip.z)
    if (t < 0) tip.addScaledVector(away, Math.pow(Math.min(1, -t / INTRO_LEAD), 2))
    if (t > sim.plan.tEnd) tip.addScaledVector(away, Math.pow(Math.min(1, (t - sim.plan.tEnd) / 0.9), 2) * 1.6)
    travel.set(nz.dirX, nz.dirY)
    tube.pose(tip, travel, nz.phase === 'draw' ? nz.speed : 0, dt)
    tube.setSqueeze(sim.squeeze * 0.9)
    const tubeOn = t < sim.plan.tEnd + 1.0
    tube.group.visible = tubeOn
    // Shadows only need re-rendering while the tube, thread or paste change.
    stage.key.shadow.autoUpdate = false
    if (tubeOn || moving || sim.thread.state !== 'none') stage.key.shadow.needsUpdate = true
    // Focus band follows the nozzle (or the whole name once the tube has gone).
    projected.copy(tip).project(camera)
    const target = tubeOn ? (projected.y + 1) / 2 : 0.52
    post.uniforms.focusY.value += (target - post.uniforms.focusY.value) * Math.min(1, dt * 3)
  }

  // Adaptive resolution: step the pixel ratio down when frames run long, up when there's room.
  let frameAvg = 16
  let settleFrames = 0
  function adapt(frameMs: number) {
    frameAvg += (frameMs - frameAvg) * 0.05
    if (++settleFrames < 45) return
    if (frameAvg > 21 && dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.25)
      stage.resize(dpr)
      settleFrames = 0
    } else if (frameAvg < 11 && dpr < maxDpr) {
      dpr = Math.min(maxDpr, dpr + 0.25)
      stage.resize(dpr)
      settleFrames = 0
    }
  }

  /** Rotate the reflected studio around the vertical: slides the highlights along the letters. */
  function setGlossRotation(y: number) {
    ;((paste.group.children[0] as THREE.Mesh).material as THREE.MeshPhysicalNodeMaterial).envMapRotation.y = y
    threadMat.envMapRotation.y = y
  }

  /**
   * Compile every pipeline before anything is shown: all paste chunks, the thread, the tube,
   * shadows and post, so no shader is built mid-intro (each build stalls a frame). Renders one
   * frame with the post fade at black.
   */
  async function warmUp() {
    const fade = post.uniforms.fade.value
    const threadOn = thread.mesh.visible
    const tubeOn = tube.group.visible
    paste.showAll(true)
    thread.mesh.visible = true
    tube.group.visible = true
    try {
      await renderer.compileAsync(scene, camera)
    } catch {
      /* compileAsync is an optimisation; the render below compiles anyway */
    }
    post.uniforms.fade.value = 0
    stage.key.shadow.needsUpdate = true
    post.pipeline.render()
    post.uniforms.fade.value = fade
    paste.showAll(false)
    thread.mesh.visible = threadOn
    tube.group.visible = tubeOn
    stage.key.shadow.needsUpdate = true
  }

  function render() {
    post.pipeline.render()
  }

  function resize() {
    stage.resize(dpr)
  }

  return {
    stage,
    renderer,
    scene,
    camera,
    quality,
    post,
    tube,
    load,
    advance,
    halt,
    applyBake,
    setGlossRotation,
    warmUp,
    sync,
    adapt,
    render,
    resize,
    get sim() {
      return sim
    },
    get paste() {
      return paste
    },
    get paper() {
      return paper
    },
    get thread() {
      return thread
    },
    get dpr() {
      return dpr
    },
  }
}

export type World = Awaited<ReturnType<typeof createWorld>>
