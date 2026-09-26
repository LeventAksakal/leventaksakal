/**
 * Boot profiling: performance marks named `boot:<stage>` (visible in a DevTools / Chrome trace).
 * With `?profile`, each mark first waits for the GPU to finish, so GPU work (bakes, shader
 * compiles, first renders) is attributed to the stage that queued it rather than a later one.
 */
import type * as THREE from 'three/webgpu'

const profile = typeof location !== 'undefined' && new URLSearchParams(location.search).has('profile')

export async function bootMark(name: string, renderer?: THREE.WebGPURenderer) {
  if (profile && renderer) await gpuSync(renderer)
  performance.mark(`boot:${name}`)
}

async function gpuSync(renderer: THREE.WebGPURenderer) {
  const b = renderer.backend as unknown as { gl?: WebGL2RenderingContext; device?: GPUDevice }
  if (b.gl) b.gl.readPixels(0, 0, 1, 1, b.gl.RGBA, b.gl.UNSIGNED_BYTE, new Uint8Array(4))
  else if (b.device) await b.device.queue.onSubmittedWorkDone()
}
