// Holds the built site to its speed and accessibility targets with Lighthouse (phone profile).
// It measures a running preview, so the response headers (the content security policy among
// them) are the production ones:
//   npm run build && npm run preview        in one terminal
//   npm run budget                          in another
// The home page is measured three times and judged on the median, because one performance run
// swings by several points with the load on the machine. The CI runs this on every change to
// the code; a new post or shelf entry does not go through it.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIGHTHOUSE = 'lighthouse@13.6.0';
const base = (process.argv[2] ?? 'http://127.0.0.1:8788').replace(/\/$/, '');

// Targets are in SITE.md ("Speed and accessibility"). The first run on GitHub's runner
// (16 Nov 2026) read 99, 99, 99 for the home page; a desk with other work going reads 83 to 95.
const PAGES = [
  { path: '/', runs: 3, performance: 90, weightKiB: 600 },
  { path: '/writing/', runs: 1, performance: 90, weightKiB: 150 },
];
const FULL = ['accessibility', 'best-practices', 'seo'];
const MAX_SHIFT = 0.01;

const out = join(tmpdir(), `budget-${process.pid}`);
mkdirSync(out, { recursive: true });
const chrome = ['--headless=new', process.env.CI && '--no-sandbox'].filter(Boolean).join(' ');
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function measure(url, name) {
  const file = join(out, `${name}.json`);
  const args = ['--yes', LIGHTHOUSE, url, '--quiet', `--chrome-flags="${chrome}"`, '--output=json', `--output-path="${file}"`];
  execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'], shell: true });
  return JSON.parse(readFileSync(file, 'utf8'));
}

const failures = [];
const rows = [];
for (const [n, page] of PAGES.entries()) {
  const reports = [];
  for (let run = 0; run < page.runs; run += 1) reports.push(measure(base + page.path, `page${n}-run${run}`));
  const score = (r, id) => Math.round(r.categories[id].score * 100);
  const perf = reports.map((r) => score(r, 'performance'));
  const last = reports.at(-1);
  const weight = Math.round(last.audits['total-byte-weight'].numericValue / 1024);
  const shift = Math.max(...reports.map((r) => r.audits['cumulative-layout-shift'].numericValue));
  const lcp = median(reports.map((r) => r.audits['largest-contentful-paint'].numericValue));
  const tbt = median(reports.map((r) => r.audits['total-blocking-time'].numericValue));

  if (median(perf) < page.performance) failures.push(`${page.path}: performance ${median(perf)} (runs: ${perf.join(', ')}), needs ${page.performance} or more`);
  if (weight > page.weightKiB) failures.push(`${page.path}: page weight ${weight} KiB, budget is ${page.weightKiB} KiB`);
  if (shift > MAX_SHIFT) failures.push(`${page.path}: layout shift ${shift.toFixed(3)}, must stay at 0`);
  for (const id of FULL) {
    const worst = reports.reduce((a, b) => (score(a, id) <= score(b, id) ? a : b));
    if (score(worst, id) === 100) continue;
    const failed = worst.categories[id].auditRefs
      .map((ref) => worst.audits[ref.id])
      .filter((audit) => audit.score !== null && audit.score < 1 && !['informative', 'manual', 'notApplicable'].includes(audit.scoreDisplayMode))
      .map((audit) => `${audit.id}: ${audit.title}`);
    failures.push(`${page.path}: ${id} ${score(worst, id)}, must be 100. Failing: ${failed.join('; ') || 'see the report'}`);
  }
  rows.push(
    `| ${page.path} | ${median(perf)} (${perf.join(', ')}) | ${FULL.map((id) => Math.min(...reports.map((r) => score(r, id)))).join(' / ')} | ${(lcp / 1000).toFixed(1)} s | ${Math.round(tbt)} ms | ${shift.toFixed(3)} | ${weight} KiB |`,
  );
}

const table = [
  '| Page | Performance, median (runs) | Accessibility / best practices / SEO | LCP | Blocking time | Layout shift | Weight |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
].join('\n');
const verdict = failures.length ? `Budget failed:\n${failures.map((f) => `- ${f}`).join('\n')}` : 'Budget met.';
console.log(`${table}\n\n${verdict}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse, phone profile\n\n${table}\n\n${verdict}\n`);
process.exit(failures.length ? 1 : 0);
