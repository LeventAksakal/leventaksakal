// Reads back the baked paper texture: per-channel mean/std and a PNG crop (1:1 texels) for A/B.
// Usage: node tools/paper-stats.mjs <url> <out.png> [quality]
import { chromium } from 'playwright'
import fs from 'node:fs'
const [url, out, quality = 'medium'] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: 400, height: 300 } })).newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
const t0 = Date.now()
await p.goto(`${url}?capture&webgl&quality=${quality}`)
await p.waitForFunction(() => window.site?.world, null, { timeout: 600000 })
const boot = Date.now() - t0
const r = await p.evaluate(async () => {
  const w = window.site.world
  const rt = w.paperBake
  const W = rt.width, H = rt.height
  const px = await w.renderer.readRenderTargetPixelsAsync(rt, 0, 0, W, H)
  const stats = [0, 1, 2].map((c) => {
    let s = 0, s2 = 0, n = 0
    for (let i = c; i < px.length; i += 16) { const v = px[i] / 255; s += v; s2 += v * v; n++ }
    const m = s / n
    return [+m.toFixed(4), +Math.sqrt(s2 / n - m * m).toFixed(4)]
  })
  // crops: centre (where the name is) and the hatched upper-left corner, 768×384 texels each
  const crop = async (x0, y0) => {
    const cw = 768, ch = 384
    const c = new OffscreenCanvas(cw, ch * 3)
    const g = c.getContext('2d')
    for (let ci = 0; ci < 3; ci++) {
      const img = g.createImageData(cw, ch)
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const v = px[((y0 + y) * W + x0 + x) * 4 + ci]
        const o = (y * cw + x) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255
      }
      g.putImageData(img, 0, ci * ch)
    }
    const blob = await c.convertToBlob({ type: 'image/png' })
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  }
  return { W, H, stats, centre: await crop(Math.round(W / 2 - 384), Math.round(H / 2 - 192)), corner: await crop(Math.round(W * 0.2), Math.round(H * 0.25)) }
})
fs.writeFileSync(out.replace('.png', '-centre.png'), Buffer.from(r.centre))
fs.writeFileSync(out.replace('.png', '-corner.png'), Buffer.from(r.corner))
console.log(JSON.stringify({ boot_ms: boot, W: r.W, H: r.H, 'mean/std [albedo, relief, cover]': r.stats }))
await b.close()
