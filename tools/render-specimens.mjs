// Renders "Levent Aksakal" in each candidate font with Chromium's shaper (HarfBuzz),
// one high-res black-on-white PNG per font, for skeletonization.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const fonts = ['Sacramento', 'Yellowtail', 'Damion', 'MrDafoe', 'HomemadeApple']
const text = process.argv[2] ?? 'Levent Aksakal'
const size = Number(process.argv[3] ?? 360)
const faces = fonts.map(f => `@font-face{font-family:${f};src:url(data:font/ttf;base64,${fs.readFileSync(`${here}/fonts/${f}-Regular.ttf`).toString('base64')})}`).join('\n')
const html = `<style>${faces} body{margin:0;background:#fff} div{display:inline-block;white-space:nowrap;padding:${size*0.35}px ${size*0.3}px;font-size:${size}px;line-height:1;color:#000}</style>` +
  fonts.map(f => `<div id="${f}" style="font-family:${f}">${text}</div><br>`).join('')
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
await page.setContent(html)
await page.evaluate(() => document.fonts.ready)
for (const f of fonts) await page.locator('#' + f).screenshot({ path: `${here}/out/specimen-${f}.png` })
const gl = await page.evaluate(async () => {
  const c = document.createElement('canvas'); const g = c.getContext('webgl2')
  const dbg = g && g.getExtension('WEBGL_debug_renderer_info')
  let gpu = 'no navigator.gpu'
  if (navigator.gpu) { const a = await navigator.gpu.requestAdapter(); gpu = a ? 'adapter ok' : 'no adapter' }
  return { webgl2: !!g, renderer: dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, float: !!(g && g.getExtension('EXT_color_buffer_float')), gpu }
})
console.log(JSON.stringify(gl))
await browser.close()
