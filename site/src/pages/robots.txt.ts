import type { APIContext } from 'astro';
import { site } from '../data/site';

// Everything is public and may be crawled, by search engines and by AI crawlers alike.
export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site ?? site.url);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
