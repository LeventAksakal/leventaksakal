// Checks the built site (dist/) for links that lead nowhere: every link, image and script that
// points inside the site must exist in the build, and a #fragment must be an id on its page.
// Links to other sites are not fetched (slow, and their failures are not ours).
//   npm run build && npm run links
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';

const DIST = 'dist';
const ORIGIN = 'https://leventaksakal.com';

const pages = (await readdir(DIST, { recursive: true })).filter((f) => f.endsWith('.html')).map((f) => f.replaceAll('\\', '/'));
const html = new Map();
const ids = new Map();
const read = async (file) => {
  if (!html.has(file)) {
    const text = await readFile(join(DIST, file), 'utf8');
    html.set(file, text);
    ids.set(file, new Set([...text.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  }
  return html.get(file);
};

// A site path to the file that serves it, the way Pages resolves it.
function resolve(path) {
  const clean = decodeURIComponent(path).replace(/^\/+/, '');
  for (const candidate of [clean, posix.join(clean, 'index.html'), `${clean.replace(/\/$/, '')}.html`]) {
    const full = join(DIST, candidate);
    if (candidate && existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return clean === '' && existsSync(join(DIST, 'index.html')) ? 'index.html' : null;
}

const broken = [];
let checked = 0;
for (const page of pages) {
  const text = await read(page);
  const targets = new Set();
  for (const m of text.matchAll(/\s(?:href|src|poster)=["']([^"']+)["']/g)) targets.add(m[1]);
  for (const m of text.matchAll(/\ssrcset=["']([^"']+)["']/g)) for (const part of m[1].split(',')) targets.add(part.trim().split(/\s+/)[0]);

  for (let target of targets) {
    target = target.replaceAll('&amp;', '&');
    if (target.startsWith(ORIGIN)) target = target.slice(ORIGIN.length) || '/';
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target) || target.startsWith('/cdn-cgi/')) continue;
    const [pathAndQuery, fragment] = target.split('#');
    const path = pathAndQuery.split('?')[0];
    const file = path === '' ? page : resolve(path.startsWith('/') ? path : posix.join('/', dirname(page), path));
    checked += 1;
    if (!file) broken.push(`${page}: ${target} (no such file in the build)`);
    else if (fragment && file.endsWith('.html')) {
      await read(file);
      if (!ids.get(file).has(decodeURIComponent(fragment))) broken.push(`${page}: ${target} (no element with id "${fragment}" on ${file})`);
    }
  }
}

if (broken.length) {
  console.error(`${broken.length} broken link(s) in the build:`);
  for (const line of broken) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`${checked} internal links on ${pages.length} pages: all resolve.`);
