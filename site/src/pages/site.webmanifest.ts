import { site, photos } from '../data/site';

// Name, colours and icons for "add to home screen". Built from the site data.
export function GET() {
  const manifest = {
    name: site.name,
    short_name: 'Levent',
    description: site.description,
    start_url: '/',
    display: 'browser',
    background_color: photos[0].bg,
    theme_color: photos[0].bg,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
