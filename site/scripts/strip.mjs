// Removes EXIF, XMP and IPTC (camera model, capture time, GPS) from images, in place, before
// they are committed: the repository is public and so is its history.
//   npm run strip -- src/assets/photos/new.jpg
//   npm run strip -- --max 1600 src/content/writing/img/picture.jpg
// --max <pixels> also shrinks anything wider (a picture in a post is shown at most 750px wide,
// and the build does not resize those). A file that needs neither is left untouched, so running
// this twice costs no quality.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
const at = args.indexOf('--max');
const max = at === -1 ? 0 : Number(args.splice(at, 2)[1]);
if (args.length === 0 || Number.isNaN(max)) {
  console.error('Usage: npm run strip -- [--max <pixels wide>] <image> [more images]');
  process.exit(1);
}

for (const file of args) {
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  const tagged = Boolean(meta.exif || meta.xmp || meta.iptc);
  const wide = max > 0 && meta.width > max;
  if (!tagged && !wide) {
    console.log(`${file}: nothing to do`);
    continue;
  }
  // rotate() bakes in the orientation the metadata carried, so the picture still stands upright.
  let image = sharp(input).rotate();
  if (wide) image = image.resize({ width: max, withoutEnlargement: true });
  const output =
    meta.format === 'png' ? image.png() : meta.format === 'webp' ? image.webp({ quality: 92 }) : image.jpeg({ quality: 92, mozjpeg: true });
  await writeFile(file, await output.toBuffer());
  console.log(`${file}: ${[tagged && 'metadata removed', wide && `shrunk from ${meta.width}px to ${max}px wide`].filter(Boolean).join(', ')}`);
}
