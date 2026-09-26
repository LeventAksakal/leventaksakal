/**
 * TEMPORARY intro diagnostics (cold-start investigation). Every line is prefixed `[intro-diag]`;
 * remove this module and its calls once the cold-start intro is confirmed on real hardware.
 *
 * Logs boot stages with times since navigation start, the renderer backend and GPU, and above all
 * *why* the page ended in its final state without the intro (slow boot, device lost, seen,
 * reduced motion, `?final`, a skip input).
 */
import type * as THREE from 'three/webgpu'

const TAG = '[intro-diag]'
const ms = () => `+${Math.round(performance.now())}ms`

export function diag(event: string, detail?: unknown) {
  if (detail === undefined) console.info(TAG, ms(), event)
  else console.info(TAG, ms(), event, detail)
}

export function diagWarn(event: string, detail?: unknown) {
  console.warn(TAG, ms(), event, detail ?? '')
}

/** The `boot:*` performance marks so far (GPU-synced only with `?profile`). */
export function diagBootMarks() {
  const marks = performance
    .getEntriesByType('mark')
    .filter((m) => m.name.startsWith('boot:'))
    .map((m) => `${m.name.slice(5)} ${Math.round(m.startTime)}ms`)
  diag('boot marks', marks.join(' · '))
}

/** Backend, GPU and environment: enough to tell a WebGPU/WebGL or driver difference apart. */
export function diagRenderer(renderer: THREE.WebGPURenderer, extra: Record<string, unknown>) {
  const b = renderer.backend as unknown as {
    isWebGPUBackend?: boolean
    gl?: WebGL2RenderingContext
    device?: GPUDevice & { adapterInfo?: GPUAdapterInfo }
  }
  let gpu = 'unknown'
  try {
    if (b.gl) {
      const ext = b.gl.getExtension('WEBGL_debug_renderer_info')
      gpu = String(ext ? b.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : b.gl.getParameter(b.gl.RENDERER))
    } else if (b.device?.adapterInfo) {
      const i = b.device.adapterInfo
      gpu = [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(' / ') || 'unnamed adapter'
    }
  } catch {
    /* best effort */
  }
  diag('renderer', {
    backend: b.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
    gpu,
    ua: navigator.userAgent,
    viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
    cores: navigator.hardwareConcurrency,
    ...extra,
  })
}
