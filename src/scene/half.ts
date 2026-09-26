/**
 * Fast float32 → float16 conversion with lookup tables (van der Zijp).
 * Used to pack height-field chunks into HalfFloat textures, which are filterable everywhere
 * (float32 linear filtering is optional on both WebGL2 and WebGPU).
 */
const baseTable = new Uint16Array(512)
const shiftTable = new Uint8Array(512)
for (let i = 0; i < 256; i++) {
  const e = i - 127
  if (e < -27) {
    baseTable[i] = 0x0000
    baseTable[i | 0x100] = 0x8000
    shiftTable[i] = shiftTable[i | 0x100] = 24
  } else if (e < -14) {
    baseTable[i] = 0x0400 >> (-e - 14)
    baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000
    shiftTable[i] = shiftTable[i | 0x100] = -e - 1
  } else if (e <= 15) {
    baseTable[i] = (e + 15) << 10
    baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000
    shiftTable[i] = shiftTable[i | 0x100] = 13
  } else if (e < 128) {
    baseTable[i] = 0x7c00
    baseTable[i | 0x100] = 0xfc00
    shiftTable[i] = shiftTable[i | 0x100] = 24
  } else {
    baseTable[i] = 0x7c00
    baseTable[i | 0x100] = 0xfc00
    shiftTable[i] = shiftTable[i | 0x100] = 13
  }
}
const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

export function toHalf(v: number): number {
  f32[0] = v
  const f = u32[0]
  const e = (f >> 23) & 0x1ff
  return baseTable[e] + ((f & 0x007fffff) >> shiftTable[e])
}

/** float16 bits → number (sufficient for heights; no NaN handling). */
export function fromHalf(h: number): number {
  const s = h & 0x8000 ? -1 : 1
  const e = (h >> 10) & 0x1f
  const m = h & 0x3ff
  if (e === 0) return s * m * 2 ** -24
  if (e === 31) return s * Infinity
  return s * 2 ** (e - 15) * (1 + m / 1024)
}
