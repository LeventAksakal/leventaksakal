// Removes EXIF, XMP and IPTC (camera model, capture time, GPS) from images, in place, before
// they are committed: the repository is public and so is its history.
//   npm run strip -- src/assets/photos/new.jpg
//   npm run strip -- --max 1600 src/content/writing/img/picture.jpg
//   npm run strip -- --check            every image in src/ and public/; changes nothing
//   npm run strip -- --check a.jpg b.png
// --max <pixels> also shrinks anything wider (a picture in a post is shown at most 750px wide,
// and the build does not resize those). A file that needs neither is left untouched, so running
// this twice costs no quality.
// --check only reports: it exits 1 and names each image that still carries metadata. The commit
// hook and the CI run it.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const IMAGE = /\.(jpe?g|png|webp|avif|tiff?|heic)$/i;
const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  if (at !== -1) args.splice(at, 1);
  return at !== -1;
};
const check = flag('--check');
const at = args.indexOf('--max');
const max = at === -1 ? 0 : Number(args.splice(at, 2)[1]);

async function images(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && IMAGE.test(entry.name)) found.push(join(entry.parentPath, entry.name));
  }
  return found;
}

const tagged = (meta) => Boolean(meta.exif || meta.xmp || meta.iptc);

if (check) {
  const files = args.length ? args.filter((f) => IMAGE.test(f)) : [...(await images('src')), ...(await images('public'))];
  const bad = [];
  for (const file of files) {
    if (tagged(await sharp(await readFile(file)).metadata())) bad.push(file);
  }
  if (bad.length) {
    console.error(`${bad.length} image(s) still carry EXIF, XMP or IPTC metadata (camera, time, possibly GPS):`);
    for (const file of bad) console.error(`  ${file}`);
    console.error('Fix: from site/, run  npm run strip -- <path under site/>  for each, then commit again.');
    process.exit(1);
  }
  console.log(`${files.length} image(s) checked: no metadata.`);
  process.exit(0);
}

if (args.length === 0 || Number.isNaN(max)) {
  console.error('Usage: npm run strip -- [--max <pixels wide>] <image> [more images]\n       npm run strip -- --check [images]');
  process.exit(1);
}

for (const file of args) {
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  const wide = max > 0 && meta.width > max;
  if (!tagged(meta) && !wide) {
    console.log(`${file}: nothing to do`);
    continue;
  }
  // rotate() bakes in the orientation the metadata carried, so the picture still stands upright.
  let image = sharp(input).rotate();
  if (wide) image = image.resize({ width: max, withoutEnlargement: true });
  const output =
    meta.format === 'png' ? image.png() : meta.format === 'webp' ? image.webp({ quality: 92 }) : image.jpeg({ quality: 92, mozjpeg: true });
  await writeFile(file, await output.toBuffer());
  console.log(`${file}: ${[tagged(meta) && 'metadata removed', wide && `shrunk from ${meta.width}px to ${max}px wide`].filter(Boolean).join(', ')}`);
}
