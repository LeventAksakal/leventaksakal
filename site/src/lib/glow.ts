// The light behind the hero: the photograph shrunk, blurred, saturated and faded out towards
// the bottom at build time, then inlined. The browser only stretches a picture of about 1 KB.
// The same look done with a CSS blur filter and a mask kept a phone's renderer busy for about
// a third of a second around first paint.
import sharp from 'sharp';

const W = 96;
const H = 54;
const fade = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff"/><stop offset=".96" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
);

/** `file` is a path from the project root (the folder `npm run build` runs in). */
export async function glow(file: string): Promise<string> {
  const out = await sharp(file)
    .resize(W, H, { fit: 'cover' })
    .blur(9)
    .modulate({ saturation: 1.8 })
    .composite([{ input: fade, blend: 'dest-in' }])
    .webp({ quality: 64, alphaQuality: 80 })
    .toBuffer();
  return `data:image/webp;base64,${out.toString('base64')}`;
}
