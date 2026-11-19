// Draws the profile README: profile/*.svg and README.md, from profile/stats.json (the numbers,
// written by collect.mjs) and site/src/data/site.ts (the name, the links and the photographs).
//
//   node profile/render.mjs
//
// GitHub shows a README's SVG files as images: no scripts, no outside fonts, no hover. So each
// file carries what it needs: the typeface cut down to the characters it draws, its colours for
// one GitHub theme (every chart exists as -light and -dark, chosen by <picture> in the README),
// and, in the hero, the six photographs. Needs `npm install` in site/ (sharp, subset-font).

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
const stats = JSON.parse(fs.readFileSync(path.join(here, 'stats.json'), 'utf8'));

const W = 760; // every drawing is 760 units wide and scales to the README column

// Colours. Ink and rules are GitHub's own for each theme, so a chart sits in the page like text.
// The blue ramp and the categorical hues were checked with the dataviz palette validator against
// both page grounds (#ffffff and #0d1117): colour-blind separation, lightness band, contrast.
const THEMES = {
  light: {
    ink: '#1f2328', soft: '#59636e', track: '#eaeef2',
    seq: ['#b7d3f6', '#6da7ec', '#2a78d6', '#184f95', '#0d366b'],
    cat: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],
    other: '#afb8c1', bar: '#2a78d6',
  },
  dark: {
    ink: '#f0f6fc', soft: '#9198a1', track: '#1a2029',
    seq: ['#104281', '#1c5cab', '#3987e5', '#86b6ef', '#cde2fb'],
    cat: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9'],
    other: '#484f58', bar: '#3987e5',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => n.toLocaleString('en-US');
const short = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
const pct = (n) => (n < 0.01 ? 'under 1%' : `${Math.round(n * 100)}%`);
const r1 = (n) => Math.round(n * 10) / 10;
const day = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]} ${y}`;
};

// Archivo, cut to the characters one drawing uses and inlined. The site's own cut keeps every
// Latin letter (45 KB); a chart needs a few dozen glyphs (about 6 KB).
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

// Five steps of "how many", cut where the non-zero values fall into fifths.
const cutsOf = (values) => {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  return [...new Set([1, 2, 3, 4].map((i) => s[Math.floor((s.length * i) / 5)]))];
};
const levelOf = (v, cuts) => cuts.filter((c) => v >= c).length;
const ranges = (cuts) =>
  [1, ...cuts]
    .map((lo, i, all) => {
      const hi = all[i + 1] === undefined ? null : all[i + 1] - 1;
      return hi === null ? { i, text: `${lo}+` } : hi < lo ? null : { i, text: hi === lo ? `${lo}` : `${lo} to ${hi}` };
    })
    .filter(Boolean);

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

// ---- Four figures, set in type ----

function figures(t) {
  const c = stats.commits;
  const cols = [
    [num(c.window), 'commits'],
    [num(c.activeDays), `days with a commit, of ${stats.window.days}`],
    [num(stats.repos.activeInWindow), 'repositories'],
    [short(stats.lines.codeTotal), 'lines of source standing'],
  ];
  const xs = [0, 170, 370, 540];
  const body = cols
    .map(
      ([big, small], i) =>
        `<text class="d n" x="${xs[i]}" y="40" style="font-size:42px">${big}</text><text class="s" x="${xs[i] + 1}" y="66">${small}</text>`,
    )
    .join('');
  return { h: 76, body, ...t, label: cols.map((x) => x.join(' ')).join(', ') };
}

// ---- The year by project: one row a project, one cell a week ----

const projectTotals = stats.projects
  .map((name) => ({ name, total: stats.weeks.reduce((a, w) => a + w.commits[name], 0) }))
  .sort((a, b) => (a.name === 'Everything else') - (b.name === 'Everything else') || b.total - a.total);

function year(t) {
  const X0 = 142;
  const pitch = 10.8;
  const cw = 8.8;
  const ROW = 26;
  const TOP = 24;
  const cuts = cutsOf(stats.weeks.flatMap((w) => Object.values(w.commits)));
  let body = '';
  let last = -9;
  stats.weeks.forEach((w, i) => {
    const [, m] = w.from.split('-').map(Number);
    const prev = i ? Number(stats.weeks[i - 1].from.split('-')[1]) : m;
    if (i && m !== prev && i - last >= 3) {
      body += `<text class="s" x="${r1(X0 + i * pitch)}" y="13" style="font-size:13px">${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]}</text>`;
      last = i;
    }
  });
  projectTotals.forEach(({ name, total }, r) => {
    const y = TOP + r * ROW;
    body += `<text x="0" y="${y + 15}">${esc(name)}</text><text class="s n e" x="${W}" y="${y + 15}">${num(total)}</text>`;
    stats.weeks.forEach((w, i) => {
      const v = w.commits[name];
      body += `<rect x="${r1(X0 + i * pitch)}" y="${y}" width="${cw}" height="20" rx="2" fill="${v ? t.seq[levelOf(v, cuts)] : t.track}"/>`;
    });
  });
  const ly = TOP + projectTotals.length * ROW + 12;
  let lx = X0;
  body += `<text class="s" x="0" y="${ly + 11}" style="font-size:13px">Commits in a week</text>`;
  for (const { i, text } of ranges(cuts)) {
    body += `<rect x="${lx}" y="${ly}" width="${cw}" height="14" rx="2" fill="${t.seq[i]}"/><text class="s n" x="${lx + cw + 6}" y="${ly + 11}" style="font-size:13px">${text}</text>`;
    lx += cw + 6 + text.length * 7.2 + 18;
  }
  return {
    h: ly + 18, body, ...t,
    label: `Commits a week by project, ${day(stats.window.from)} to ${day(stats.window.to)}: ${projectTotals.map((x) => `${x.name} ${num(x.total)}`).join(', ')}.`,
  };
}

// ---- Languages: one bar, split by lines of source ----

const langs = (() => {
  const all = Object.entries(stats.lines.code);
  const top = all.slice(0, 7).map(([name, lines]) => ({ name, lines }));
  const rest = all.slice(7);
  if (rest.length) top.push({ name: `${rest.length} more`, lines: rest.reduce((a, [, n]) => a + n, 0), other: true });
  return top.map((l) => ({ ...l, share: l.lines / stats.lines.codeTotal }));
})();

function languages(t) {
  const GAP = 2;
  const room = W - GAP * (langs.length - 1);
  let x = 0;
  let body = `<clipPath id="b"><rect width="${W}" height="16" rx="4"/></clipPath><g clip-path="url(#b)">`;
  langs.forEach((l, i) => {
    const w = Math.max(3, l.share * room);
    body += `<rect x="${r1(x)}" y="0" width="${r1(w)}" height="16" fill="${l.other ? t.other : t.cat[i]}"/>`;
    x += w + GAP;
  });
  body += '</g>';
  langs.forEach((l, i) => {
    const cx = (i % 4) * 190;
    const cy = 46 + Math.floor(i / 4) * 30;
    body += `<rect x="${cx}" y="${cy - 10}" width="10" height="10" rx="2" fill="${l.other ? t.other : t.cat[i]}"/><text x="${cx + 17}" y="${cy}">${esc(l.name)}<tspan class="s n" dx="8">${short(l.lines)}</tspan></text>`;
  });
  return {
    h: 46 + Math.floor((langs.length - 1) / 4) * 30 + 8, body, ...t,
    label: `Lines of source by language: ${langs.map((l) => `${l.name} ${short(l.lines)} (${pct(l.share)})`).join(', ')}.`,
  };
}

// ---- Tools: in how many repositories each one is named ----

// The top twelve, cut back to the last full group of equals so that no tie is split.
const toolRows = (() => {
  const all = Object.entries(stats.tools);
  const rows = all.slice(0, 12);
  while (all[rows.length] && rows.length > 1 && all[rows.length][1] === rows.at(-1)[1]) rows.pop();
  return rows;
})();

function tools(t) {
  const ROW = 25;
  const X0 = 150;
  const max = toolRows[0][1];
  const full = W - X0 - 34;
  let body = '';
  toolRows.forEach(([name, n], i) => {
    const y = i * ROW;
    const w = (n / max) * full;
    body +=
      `<text class="e" x="${X0 - 12}" y="${y + 15}">${esc(name)}</text>` +
      `<path d="M${X0} ${y + 5}h${r1(w - 4)}a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4h-${r1(w - 4)}z" fill="${t.bar}"/>` +
      `<text class="s n" x="${r1(X0 + w + 8)}" y="${y + 15}">${n}</text>`;
  });
  return {
    h: toolRows.length * ROW, body, ...t,
    label: `Repositories that use each tool: ${toolRows.map(([name, n]) => `${name} ${n}`).join(', ')}.`,
  };
}

// ---- Hours: weekday by hour of the day ----

function hours(t) {
  const X0 = 44;
  const pitch = (W - X0) / 24;
  const cw = pitch - 3;
  const ROW = 22;
  const cuts = cutsOf(stats.punch.flat());
  let body = '';
  'Mon Tue Wed Thu Fri Sat Sun'.split(' ').forEach((name, d) => {
    body += `<text class="s" x="0" y="${d * ROW + 14}" style="font-size:13px">${name}</text>`;
    for (let hr = 0; hr < 24; hr++) {
      const v = stats.punch[d][hr];
      body += `<rect x="${r1(X0 + hr * pitch)}" y="${d * ROW}" width="${r1(cw)}" height="18" rx="2" fill="${v ? t.seq[levelOf(v, cuts)] : t.track}"/>`;
    }
  });
  const y = 7 * ROW + 14;
  for (let hr = 0; hr < 24; hr += 3)
    body += `<text class="s n" x="${r1(X0 + hr * pitch)}" y="${y}" style="font-size:13px">${String(hr).padStart(2, '0')}:00</text>`;
  const ly = y + 14;
  let lx = X0;
  for (const { i, text } of ranges(cuts)) {
    body += `<rect x="${lx}" y="${ly}" width="9" height="14" rx="2" fill="${t.seq[i]}"/><text class="s n" x="${lx + 15}" y="${ly + 11}" style="font-size:13px">${text}</text>`;
    lx += 15 + text.length * 7.2 + 18;
  }
  return { h: ly + 18, body, ...t, label: `Commits by weekday and hour of the day. ${busiestHours()}` };
}

function busiestHours() {
  const byHour = Array.from({ length: 24 }, (_, hr) => stats.punch.reduce((a, d) => a + d[hr], 0));
  const top = byHour.map((n, hr) => [hr, n]).sort((a, b) => b[1] - a[1])[0];
  const weekend = stats.punch[5].concat(stats.punch[6]).reduce((a, b) => a + b, 0);
  return `The busiest hour is ${String(top[0]).padStart(2, '0')}:00 to ${String(top[0] + 1).padStart(2, '0')}:00; ${pct(weekend / stats.commits.window)} of the commits fall on a weekend.`;
}

// ---- The README ----

// On one line: see preview.mjs for why no paragraph in the README may hold a line end.
const picture = (name, alt) =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="profile/${name}-dark.svg"><img src="profile/${name}-light.svg" width="100%" alt="${esc(alt)}"></picture>`;

function readme(alts) {
  const c = stats.commits;
  const l = stats.lines;
  const from = day(stats.window.from);
  const to = day(stats.window.to);
  return `<!-- Generated by profile/render.mjs from site/src/data/site.ts and profile/stats.json. Edit those, not this file. The site's own README is SITE.md. -->

<a href="${site.url}"><img src="profile/hero.svg" width="100%" alt="${esc(alts.hero)}"></a>

${site.description.split('. ')[0]}. What I work on, the research and the projects are on [${site.url.replace('https://', '')}](${site.url}). [LinkedIn](${site.linkedin.href}) · [${site.email}](mailto:${site.email})

### The last twelve months

${picture('figures', alts.figures)}

<br>

${picture('year', alts.year)}

<sub>${from} to ${to}, counted from the ${stats.repos.scanned} git repositories on my machine, public and private. The longest run of days with a commit is ${c.longestStreak}; the busiest day had ${num(c.busiestDay.commits)}, on ${day(c.busiestDay.date)}. I work with coding agents: these are the commits and lines made under my name, by me and by the agents I run.</sub>

### Languages and tools

${picture('languages', alts.languages)}

<sub>${num(l.codeTotal)} non-blank lines of source in ${stats.repos.own} repositories, as they stand today. Beside them stand ${num(l.markdown)} lines of Markdown: ledgers, decisions and briefs. In the twelve months ${short(l.added)} lines of source were added and ${short(l.removed)} removed.</sub>

<br>

${picture('tools', alts.tools)}

<sub>The number of repositories whose manifests name the tool, of ${stats.repos.own}.</sub>

### When the commits land

${picture('hours', alts.hours)}

<sub>Local time. ${busiestHours()}</sub>

<details>
<summary>How the numbers are counted</summary>

<br>

Counted on ${day(stats.collected)} by [\`profile/collect.mjs\`](profile/collect.mjs) and drawn by [\`profile/render.mjs\`](profile/render.mjs); the numbers are in [\`profile/stats.json\`](profile/stats.json).

- A commit is a non-merge commit on \`main\`, \`master\`, \`stage\` or the branch checked out, made under my name. Commits that only exist on other branches are not counted.
- A repository counts as mine when I wrote at least 60% of the commits that people wrote in it. Lines and tools are counted only there.
- A line is a non-blank line in a tracked source file. Lock files, generated files, vendored code, design exports, the work folders of coding agents, data and notebooks are left out.
- A tool is counted once per repository whose \`package.json\`, \`Cargo.toml\`, \`pyproject.toml\`, \`requirements.txt\` or \`go.mod\` names it; Docker and GitHub Actions by their files.

</details>
`;
}

await hero();
const alts = {};
for (const [name, draw] of Object.entries({ figures, year, languages, tools, hours })) {
  for (const [mode, t] of Object.entries(THEMES)) {
    const d = draw(t);
    alts[name] = d.label;
    await write(`${name}-${mode}.svg`, d);
  }
}
alts.hero = `${site.name}. Six of my own photographs: ${photos.map((ph) => `${ph.place}, ${ph.when}`).join('; ')}.`;
fs.writeFileSync(path.join(repo, 'README.md'), readme(alts));
for (const [name, n] of Object.entries(sizes)) console.log(`${name.padEnd(22)} ${(n / 1024).toFixed(1)} KB`);
