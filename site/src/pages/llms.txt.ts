import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { site, industry, research, education, also, type Entry } from '../data/site';

// llms.txt (llmstxt.org): the same facts as the home page, as plain Markdown, built from the
// same data so the two cannot drift apart.
const line = (e: Entry) => {
  const about = [`${e.meta.join(', ')}.`, e.text, e.note].filter(Boolean).join(' ');
  return e.href ? `- [${e.name}](${e.href}): ${about}` : `- ${e.name}: ${about}`;
};
const section = (title: string, entries: Entry[]) => `## ${title}\n\n${entries.map(line).join('\n')}`;

export async function GET(context: APIContext) {
  const base = context.site ?? new URL(site.url);
  const posts = (await getCollection('writing', (p) => !p.data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const writing = posts.length
    ? posts.map((p) => `- [${p.data.title}](${new URL(`writing/${p.id}/`, base)}): ${p.data.description}`).join('\n')
    : `- [Writing](${new URL('writing/', base)}): nothing published yet.`;

  const body = [
    `# ${site.name}`,
    `> ${site.description}`,
    `Personal site at ${base}. English only. ${site.away}`,
    section('Industry', industry),
    section('Research', research),
    section('Education', education),
    section('Projects', also),
    `## Writing\n\n${writing}\n- [RSS feed](${new URL('rss.xml', base)})`,
    `## Contact\n\n- [Email](mailto:${site.email})\n- [GitHub](${site.github.href})\n- [LinkedIn](${site.linkedin.href})`,
  ].join('\n\n');

  return new Response(`${body}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
