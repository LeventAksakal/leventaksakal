// Draws the profile README: profile/hero.svg and README.md, from site/src/data/site.ts (the name,
// the links and the photographs).
//
//   node profile/render.mjs
//
// GitHub shows a README's SVG file as an image: no scripts, no outside fonts, no hover. So the
// hero carries what it needs: the typeface cut down to the characters it draws and the six
// photographs. Needs `npm install` in site/ (sharp, subset-font).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { site, photos } from '../site/src/data/site.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..');
const req = createRequire(path.join(repo, 'site', 'package.json'));
const load = async (name) => (await import(pathToFileURL(req.resolve(name)).href)).default;
const sharp = await load('sharp');
const subsetFont = await load('subset-font');

const W = 760; // every drawing is 760 units wide and scales to the README column

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;

// Archivo, cut to the characters one drawing uses and inlined. The site's own cut keeps every
// Latin letter (45 KB); the hero needs a few dozen glyphs.
const fontDir = path.join(repo, 'site/node_modules/@fontsource-variable/archivo/files');
const fontFiles = ['archivo-latin-wdth-normal.woff2', 'archivo-latin-ext-wdth-normal.woff2'].map((f) =>
  fs.readFileSync(path.join(fontDir, f)),
);
const axes = { wght: { min: 400, max: 700 }, wdth: { min: 100, max: 110 } };
async function fontFaces(body) {
  const chars = [...new Set([...body.matchAll(/>([^<]+)</g)].map((m) => m[1]).join(''))]
    .join('')
    .replace(/&(amp|lt|gt);/g, '&<>');
  const parts = [chars.replace(/[ĞğİıŞş]/g, ''), chars.replace(/[^ĞğİıŞş]/g, '')];
  let css = '';
  for (const [i, text] of parts.entries()) {
    if (!text) continue;
    const cut = await subsetFont(fontFiles[i], text, { targetFormat: 'woff2', variationAxes: axes });
    css += `@font-face{font-family:${i ? 'Avx' : 'Av'};src:url(data:font/woff2;base64,${cut.toString('base64')}) format('woff2');font-weight:400 700;font-stretch:100% 110%}`;
  }
  return css;
}

const sizes = {};
async function write(name, { h, body, css = '', ink, soft, label }) {
  const style =
    (await fontFaces(body)) +
    `text{font-family:Av,Avx,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;fill:${ink}}` +
    `.d{font-weight:620;font-stretch:108%;letter-spacing:-.01em}.s{fill:${soft}}.n{font-variant-numeric:tabular-nums}` +
    `.e{text-anchor:end}.m{text-anchor:middle}` +
    css;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>${style}</style>${body}</svg>\n`;
  fs.writeFileSync(path.join(here, name), svg);
  sizes[name] = svg.length;
}

// ---- The hero: six photographs, the ground and accent colour following the one on screen ----

async function hero() {
  const n = photos.length;
  const T = 6; // seconds a photograph stays
  const F = 1.1; // seconds of cross-fade
  const total = n * T;
  const p = (t) => `${r1((t / total) * 100 * 10) / 10}%`;
  const BAR = 58;
  const PH = Math.round(W / 2.11);
  const CAP = 46;
  const h = BAR + PH + CAP;
  const text = '#ece8de';

  let css = `.t{fill:${text}}.q{fill:${text};fill-opacity:.7}`;
  let images = '';
  let captions = '';
  let ticks = '';
  const tickW = 26;
  const tickGap = 6;
  const tickX = W - 24 - n * tickW - (n - 1) * tickGap;
  for (const [i, ph] of photos.entries()) {
    const buf = await sharp(path.join(repo, 'site/src/assets/photos', `${ph.id}.jpg`))
      .resize(1200, Math.round(1200 / 2.11), { fit: 'cover' })
      .webp({ quality: 62, effort: 6 })
      .toBuffer();
    // The first photograph is the base and never fades. Each later one fades in over the pile
    // and stays; the last one fades out again to show the first, so the ground is never bare.
    if (i > 0) {
      const from = i * T - F;
      const stay = i === n - 1 ? total - F : (n - 1) * T;
      css += `@keyframes p${i}{0%,${p(from)}{opacity:0}${p(i * T)},${p(stay)}{opacity:1}${i === n - 1 ? '100%' : `${p(stay + 0.01)},100%`}{opacity:0}}#p${i}{animation:p${i} ${total}s linear infinite}`;
    }
    images += `<image id="p${i}" href="data:image/webp;base64,${buf.toString('base64')}" x="0" y="${BAR}" width="${W}" height="${PH}" preserveAspectRatio="xMidYMid slice"${i ? ' opacity="0"' : ''}/>`;

    const a = i * T;
    const b = (i + 1) * T;
    css += `@keyframes c${i}{${i ? `0%,${p(a)}` : '0%'}{opacity:0}${p(a + 0.5)},${p(b - 0.5)}{opacity:1}${i === n - 1 ? '100%' : `${p(b)},100%`}{opacity:0}}#c${i}{animation:c${i} ${total}s linear infinite}`;
    captions += `<g id="c${i}"${i ? ' opacity="0"' : ''}><text class="t" x="24" y="${BAR + PH + 28}">${esc(ph.place)}<tspan class="q" dx="10">${esc(ph.when)}</tspan></text></g>`;

    const x = tickX + i * (tickW + tickGap);
    css += `@keyframes k${i}{${i ? `0%,${p(a)}` : '0%'}{transform:scaleX(0)}${p(b)}{transform:scaleX(1)}${i === n - 1 ? '' : `${p(b + 0.01)},100%{transform:scaleX(0)}`}}#k${i}{animation:k${i} ${total}s linear infinite}`;
    ticks += `<rect x="${x}" y="${BAR + PH + 22}" width="${tickW}" height="2" fill="${text}" fill-opacity=".22"/><rect id="k${i}" class="ac" x="${x}" y="${BAR + PH + 22}" width="${tickW}" height="2" fill="${photos[0].accent}" transform="scale(0 1)" style="transform-box:fill-box;transform-origin:0 50%"/>`;
  }
  const hold = (key) =>
    photos.map((ph, i) => `${p(i * T)},${p((i + 1) * T - F)}{fill:${ph[key]}}`).join('') + `100%{fill:${photos[0][key]}}`;
  css += `@keyframes bg{${hold('bg')}}#bg{animation:bg ${total}s linear infinite}@keyframes ac{${hold('accent')}}`;
  // Two animations on a tick: its own fill, and the accent colour of the photograph on screen.
  css = css.replace(/#k(\d)\{animation:k\d [^}]+/g, (m) => `${m},ac ${total}s linear infinite`);
  css += `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

  const seal = fs.readFileSync(path.join(repo, 'site/public/logos/bogazici-64.webp')).toString('base64');
  const body =
    `<clipPath id="r"><rect width="${W}" height="${h}" rx="10"/></clipPath><g clip-path="url(#r)">` +
    `<rect id="bg" width="${W}" height="${h}" fill="${photos[0].bg}"/>` +
    `<text class="t d" x="24" y="37" style="font-size:23px">${esc(site.name)}</text>` +
    `<text class="q e" x="${W - 52}" y="36">SWE in Istanbul<tspan dx="9" fill-opacity=".4">/</tspan><tspan dx="9">MSc at Boğaziçi</tspan></text>` +
    `<image href="data:image/webp;base64,${seal}" x="${W - 44}" y="19" width="22" height="22"/>` +
    images + captions + ticks +
    `</g>`;
  await write('hero.svg', {
    h, body, css, ink: text, soft: text,
    label: `${site.name}. Software engineer in Istanbul, MSc at Boğaziçi University. Own photographs: ${photos.map((ph) => ph.place).join(', ')}.`,
  });
}

// ---- The README ----

// The paragraph stays on one line: see preview.mjs for why it may not hold a line end.
const readme = (alt) => `<!-- Generated by profile/render.mjs from site/src/data/site.ts. Edit that, not this file. The site's own README is SITE.md. -->

<a href="${site.url}"><img src="profile/hero.svg" width="100%" alt="${esc(alt)}"></a>

${site.description.split('. ')[0]}. What I work on, the research and the projects are on [${site.url.replace('https://', '')}](${site.url}). [LinkedIn](${site.linkedin.href}) · [${site.email}](mailto:${site.email})
`;

await hero();
fs.writeFileSync(
  path.join(repo, 'README.md'),
  readme(`${site.name}. Six of my own photographs: ${photos.map((ph) => `${ph.place}, ${ph.when}`).join('; ')}.`),
);
for (const [name, n] of Object.entries(sizes)) console.log(`${name.padEnd(22)} ${(n / 1024).toFixed(1)} KB`);
