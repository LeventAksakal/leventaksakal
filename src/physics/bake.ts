/**
 * Baked final state of the height field, for skipping the intro and for repeat visits.
 * Layout (little-endian): "PST1", u32 nx, u32 nz, u32 keyLength, key (utf-8),
 * then nx·nz float16 heights (mm), nx·nz int8 cos2θ, nx·nz int8 sin2θ.
 * Callers compress it (gzip): the field is mostly empty paper.
 */
import { fromHalf, toHalf } from '../scene/half'
import type { HeightField } from './heightfield'

const MAGIC = 0x31545350 // "PST1"

export function encodeBake(f: HeightField, key: string): Uint8Array {
  const n = f.nx * f.nz
  const keyBytes = new TextEncoder().encode(key)
  const head = 16 + keyBytes.length
  const pad = (4 - (head % 2)) % 2
  const buf = new ArrayBuffer(head + pad + n * 2 + n * 2)
  const dv = new DataView(buf)
  dv.setUint32(0, MAGIC, true)
  dv.setUint32(4, f.nx, true)
  dv.setUint32(8, f.nz, true)
  dv.setUint32(12, keyBytes.length, true)
  new Uint8Array(buf, 16, keyBytes.length).set(keyBytes)
  let o = head + pad
  for (let i = 0; i < n; i++, o += 2) dv.setUint16(o, toHalf(f.h[i] * 1000), true)
  for (let i = 0; i < n; i++) {
    const inv = f.h[i] > 1e-7 ? 1 / f.h[i] : 0
    dv.setInt8(o + i, Math.round(Math.max(-1, Math.min(1, f.dirC[i] * inv)) * 127))
    dv.setInt8(o + n + i, Math.round(Math.max(-1, Math.min(1, f.dirS[i] * inv)) * 127))
  }
  return new Uint8Array(buf)
}

/** Reads a bake into the field. Returns false if the size or key doesn't match. */
export function decodeBake(bytes: Uint8Array, f: HeightField, key?: string): boolean {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.getUint32(0, true) !== MAGIC) return false
  if (dv.getUint32(4, true) !== f.nx || dv.getUint32(8, true) !== f.nz) return false
  const kl = dv.getUint32(12, true)
  const bakedKey = new TextDecoder().decode(bytes.subarray(16, 16 + kl))
  if (key && key !== bakedKey) return false
  const n = f.nx * f.nz
  const head = 16 + kl
  let o = head + ((4 - (head % 2)) % 2)
  for (let i = 0; i < n; i++, o += 2) f.h[i] = fromHalf(dv.getUint16(o, true)) / 1000
  for (let i = 0; i < n; i++) {
    f.dirC[i] = (dv.getInt8(o + i) / 127) * f.h[i]
    f.dirS[i] = (dv.getInt8(o + n + i) / 127) * f.h[i]
  }
  f.touchAll()
  return true
}

/** Gunzips unless a server already did (Content-Encoding: gzip); checks the gzip magic bytes. */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
