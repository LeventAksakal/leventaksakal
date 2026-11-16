// Fetch cover art for the shelf into src/assets/covers/<slug>.jpg.
// Run: npm run covers            (only what is missing)
//      npm run covers -- --force (everything again)
// Sources: Wikipedia page image (films, series; albums as a fallback), Apple's search API
// (albums, series as a fallback), the Steam library capsule (games). Nothing is fetched at build or at runtime.
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = new URL('../src/assets/covers/', import.meta.url);
const shelf = JSON.parse(await readFile(new URL('../src/data/shelf.json', import.meta.url), 'utf8'));
const force = process.argv.includes('--force');
const UA = { 'User-Agent': 'shelf-cover-fetch/1.0 (static site build)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

async function get(url, as = 'json', tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    await sleep(4000 * (i + 1));
  }
  throw new Error(`gave up on ${url}`);
}

async function save(slug, buf, width) {
  const file = new URL(`${slug}.jpg`, OUT);
  const info = await sharp(buf).resize({ width, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(file.pathname.replace(/^\/(\w:)/, '$1'));
  return `${info.width}x${info.height}`;
}

async function wikiImage(item) {
  const q = new URLSearchParams({ action: 'query', titles: item.wiki ?? item.title, prop: 'pageimages', pithumbsize: '600', pilicense: 'any', redirects: '1', format: 'json' });
  const page = Object.values((await get(`https://en.wikipedia.org/w/api.php?${q}`)).query.pages)[0];
  if (!page.thumbnail) throw new Error('page has no image');
  await sleep(2500);
  return get(page.thumbnail.source, 'buffer');
}

async function appleAlbum(item) {
  const q = new URLSearchParams({ term: item.term ?? `${item.by} ${item.title}`, media: 'music', entity: 'album', limit: '50' });
  const { results } = await get(`https://itunes.apple.com/search?${q}`);
  const want = norm(item.match ?? item.title);
  const artist = item.by === 'Soundtrack' ? '' : norm(item.by);
  const hit = results.find((r) => norm(r.collectionName).includes(want) && norm(r.artistName).includes(artist));
  if (!hit) throw new Error('no album match');
  return get(hit.artworkUrl100.replace(/\/\d+x\d+bb\./, '/800x800bb.'), 'buffer');
}

async function appleSeason(item) {
  const q = new URLSearchParams({ term: item.title, media: 'tvShow', entity: 'tvSeason', limit: '25' });
  const { results } = await get(`https://itunes.apple.com/search?${q}`);
  const hit = results.find((r) => norm(r.artistName ?? '') === norm(item.title));
  if (!hit) throw new Error('no season match');
  return get(hit.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x900bb.'), 'buffer');
}

const steam = (item) => get(`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steam}/library_600x900_2x.jpg`, 'buffer')
  .catch(() => get(`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steam}/library_600x900.jpg`, 'buffer'));

await mkdir(OUT, { recursive: true });
const jobs = [
  ...shelf.films.map((i) => [i, i.series ? [wikiImage, appleSeason] : [wikiImage], 600]),
  ...shelf.games.map((i) => [i, [steam], 600]),
  ...shelf.albums.map((i) => [i, [appleAlbum, wikiImage], 640]),
];
let failed = 0;
for (const [item, sources, width] of jobs) {
  if (!force && existsSync(new URL(`${item.slug}.jpg`, OUT))) continue;
  let done = false;
  for (const source of sources) {
    try {
      console.log(`ok    ${item.slug.padEnd(26)} ${source.name.padEnd(10)} ${await save(item.slug, await source(item), width)}`);
      done = true;
      break;
    } catch (e) {
      console.log(`miss  ${item.slug.padEnd(26)} ${source.name.padEnd(10)} ${e.message}`);
    }
    await sleep(1500);
  }
  if (!done) failed++;
  await sleep(1200);
}
console.log(failed ? `${failed} cover(s) missing: add a "wiki" page title or a better "term" in shelf.json and run again.` : 'All covers present.');
process.exit(failed ? 1 : 0);
