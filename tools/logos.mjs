// Resizes the downloaded official logo files (see public/logos/SOURCES.md) to 2× display size in
// Chromium (high-quality resampling, colours untouched) and writes the smaller of PNG and WebP
// (lossless, or high-quality lossy where a job allows it) to public/logos/. Files already small and
// crisp are copied as they are. Usage: node tools/logos.mjs <dir with the downloaded originals>
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2] ?? 'tools/out/logos'
const out = 'public/logos'
// name ← original file, output height in px (2× the largest display height; 0 = copy as is),
// lossy = WebP quality for detailed artwork (fine print in a seal compresses badly losslessly)
const jobs = [
  { name: 'ozyegin', file: 'ozu-ou_logo_ing_white.png', height: 0 },
  { name: 'bogazici', file: 'boun-kimlik-12.png', height: 112, lossy: 0.9 },
  { name: 'constructor', file: 'ctor-favicon-48.png', height: 48 },
  { name: 'tubitak-sage', file: 'sage-cropped-7-favicon-1.png', height: 48 },
]

fs.mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage()
for (const j of jobs) {
  const input = path.join(src, j.file)
  if (!fs.existsSync(input)) {
    console.log('skip (missing)', input)
    continue
  }
  if (!j.height) {
    const ext = path.extname(j.file)
    fs.copyFileSync(input, path.join(out, j.name + ext))
    console.log(`${j.name}${ext}  copied  ${fs.statSync(input).size} B`)
    continue
  }
  const b64 = fs.readFileSync(input).toString('base64')
  const res = await p.evaluate(
    async ({ b64, height, lossy }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const full = await createImageBitmap(blob)
      const h = Math.min(height, full.height)
      const w = Math.round((full.width * h) / full.height)
      const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      const c = new OffscreenCanvas(w, h)
      c.getContext('2d').drawImage(bmp, 0, 0)
      const enc = async (type, quality) => {
        const r = new FileReader()
        const done = new Promise((ok) => (r.onload = () => ok(String(r.result).split(',')[1])))
        r.readAsDataURL(await c.convertToBlob({ type, quality }))
        return done
      }
      return { w, h, png: await enc('image/png'), webp: await enc('image/webp', lossy ?? 1) }
    },
    { b64, height: j.height, lossy: j.lossy },
  )
  const png = Buffer.from(res.png, 'base64')
  const webp = Buffer.from(res.webp, 'base64')
  const [ext, buf] = webp.length < png.length ? ['webp', webp] : ['png', png]
  fs.writeFileSync(path.join(out, `${j.name}.${ext}`), buf)
  console.log(`${j.name}.${ext}  ${res.w}×${res.h}  ${buf.length} B  (png ${png.length} B, webp ${webp.length} B)`)
}
await b.close()
