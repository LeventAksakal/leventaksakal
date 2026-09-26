// Tile PNG frames into one contact sheet (labelled by index × step seconds).
// Usage: node tools/contact-sheet.mjs <out.png> <stepSeconds> <frame.png>...
import { chromium } from 'playwright'
import fs from 'node:fs'
const [out, step, ...files] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage()
const imgs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'))
const png = await p.evaluate(async ({ imgs, step }) => {
  const els = await Promise.all(imgs.map((src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })))
  const cols = 4, w = 480, h = Math.round((els[0].height / els[0].width) * w)
  const c = document.createElement('canvas')
  c.width = cols * w; c.height = Math.ceil(els.length / cols) * h
  const g = c.getContext('2d')
  els.forEach((im, k) => {
    const x = (k % cols) * w, y = Math.floor(k / cols) * h
    g.drawImage(im, x, y, w, h)
    g.fillStyle = '#ff0'; g.font = 'bold 18px sans-serif'; g.fillText(`${(k + 0.5) * step}s`, x + 8, y + 22)
  })
  return c.toDataURL('image/png')
}, { imgs, step: Number(step) })
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'))
await b.close()
