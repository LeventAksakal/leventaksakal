import type { APIContext } from 'astro';
import { site } from '../data/site';

// The site is made for people (owner, 16 Nov 2026). Search engines may index it, so that a person
// can find it by name; crawlers that collect pages for language models may not. This file only
// asks: the crawlers that ignore it are stopped at Cloudflare (docs/decisions/0001-bot-guard.md).
const ai = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'cohere-ai',
  'Diffbot',
  'DuckAssistBot',
  'MistralAI-User',
  'YouBot',
  'ImagesiftBot',
  'Timpibot',
  'AI2Bot',
];

export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site ?? site.url);
  const body = [
    ai.map((name) => `User-agent: ${name}`).join('\n'),
    'Disallow: /',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
