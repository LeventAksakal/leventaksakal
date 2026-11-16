// Cuts Archivo down to what this site draws: Latin text, the six Turkish letters outside
// Latin-1, weights 400 to 700 and widths 100 to 110. 176 KB of web font becomes about 50 KB.
// Run with `npm run font` after changing the ranges below or upgrading @fontsource-variable/archivo;
// the output in src/assets/fonts/ is committed. A character outside these ranges still shows,
// in the fallback face.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

const from = new URL('../node_modules/@fontsource-variable/archivo/files/', import.meta.url);
const to = new URL('../src/assets/fonts/', import.meta.url);
const axes = { wght: { min: 400, max: 700 }, wdth: { min: 100, max: 110 } };

const chars = (ranges) =>
  ranges.map(([a, b = a]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('')).join('');

// Keep in step with the unicode-range values in src/styles/global.css.
const latin = chars([[0x20, 0x7e], [0xa0, 0xff], [0x2010, 0x2027], [0x2030, 0x203a], [0x20ac], [0x2122], [0x2190, 0x2193], [0x2212]]);
const turkish = 'ĞğİıŞş';

const jobs = [
  ['archivo-latin-wdth-normal.woff2', latin, 'archivo-latin.woff2'],
  ['archivo-latin-ext-wdth-normal.woff2', turkish, 'archivo-turkish.woff2'],
  ['archivo-latin-wdth-italic.woff2', latin, 'archivo-latin-italic.woff2'],
  ['archivo-latin-ext-wdth-italic.woff2', turkish, 'archivo-turkish-italic.woff2'],
];

await mkdir(to, { recursive: true });
for (const [source, text, name] of jobs) {
  const full = await readFile(new URL(source, from));
  const cut = await subsetFont(full, text, { targetFormat: 'woff2', variationAxes: axes });
  await writeFile(new URL(name, to), cut);
  console.log(`${name}: ${(full.length / 1024).toFixed(0)} KB -> ${(cut.length / 1024).toFixed(1)} KB`);
}
