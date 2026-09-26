/**
 * A small tileable noise texture, generated on the CPU in a few milliseconds, that bakes can
 * sample instead of evaluating gradient noise per texel (MaterialX `mx_noise_float` inlines a
 * large function per call: slow to compile, slow to run, and a single huge GPU job at load).
 *
 * Each channel is improved Perlin noise (the MaterialX gradient set and lookup3 hash) on a
 * lattice that wraps every PERIOD cells, sampled NOISE_RES / PERIOD texels per cell, in [−1, 1]
 * like mx_noise_float. Channels differ by their z plane, so they are independent.
 */
import * as THREE from 'three/webgpu'
import { toHalf } from './half'

export const NOISE_PERIOD = 32
const NOISE_RES = 256
const PLANES = [0.37, 1.61, 2.83, 4.19]

const rot = (x: number, k: number) => (x << k) | (x >>> (32 - k))

function hash(x: number, y: number, z: number): number {
  let a = (0xdeadbeef + (3 << 2) + 13) | 0
  let b = a
  let c = a
  a = (a + x) | 0
  b = (b + y) | 0
  c = (c + z) | 0
  c ^= b; c = (c - rot(b, 14)) | 0
  a ^= c; a = (a - rot(c, 11)) | 0
  b ^= a; b = (b - rot(a, 25)) | 0
  c ^= b; c = (c - rot(b, 16)) | 0
  a ^= c; a = (a - rot(c, 4)) | 0
  b ^= a; b = (b - rot(a, 14)) | 0
  c ^= b; c = (c - rot(b, 24)) | 0
  return c >>> 0
}

function grad(h: number, x: number, y: number, z: number): number {
  h &= 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return (h & 1 ? -u : u) + (h & 2 ? -v : v)
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const wrap = (i: number) => ((i % NOISE_PERIOD) + NOISE_PERIOD) % NOISE_PERIOD

function perlin(x: number, y: number, z: number): number {
  const X = Math.floor(x)
  const Y = Math.floor(y)
  const Z = Math.floor(z)
  const fx = x - X
  const fy = y - Y
  const fz = z - Z
  const u = fade(fx)
  const v = fade(fy)
  const w = fade(fz)
  const x0 = wrap(X)
  const x1 = wrap(X + 1)
  const y0 = wrap(Y)
  const y1 = wrap(Y + 1)
  const g = (ix: number, iy: number, iz: number, dx: number, dy: number, dz: number) => grad(hash(ix, iy, iz), dx, dy, dz)
  const r = lerp(
    lerp(lerp(g(x0, y0, Z, fx, fy, fz), g(x1, y0, Z, fx - 1, fy, fz), u), lerp(g(x0, y1, Z, fx, fy - 1, fz), g(x1, y1, Z, fx - 1, fy - 1, fz), u), v),
    lerp(lerp(g(x0, y0, Z + 1, fx, fy, fz - 1), g(x1, y0, Z + 1, fx - 1, fy, fz - 1), u), lerp(g(x0, y1, Z + 1, fx, fy - 1, fz - 1), g(x1, y1, Z + 1, fx - 1, fy - 1, fz - 1), u), v),
    w,
  )
  return 0.982 * r
}

let cached: THREE.DataTexture | null = null

/** RGBA HalfFloat, repeat-wrapped: sample with uv = lattice coordinates / NOISE_PERIOD. */
export function noiseTexture(): THREE.DataTexture {
  if (cached) return cached
  const data = new Uint16Array(NOISE_RES * NOISE_RES * 4)
  const s = NOISE_PERIOD / NOISE_RES
  for (let j = 0; j < NOISE_RES; j++)
    for (let i = 0; i < NOISE_RES; i++)
      for (let c = 0; c < 4; c++) data[(j * NOISE_RES + i) * 4 + c] = toHalf(perlin(i * s, j * s, PLANES[c]))
  const tex = new THREE.DataTexture(data, NOISE_RES, NOISE_RES, THREE.RGBAFormat, THREE.HalfFloatType)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  cached = tex
  return tex
}
