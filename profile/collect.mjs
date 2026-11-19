// Scans the git repositories in a folder and writes profile/stats.json, the numbers behind the
// profile README. Run by hand on the machine that holds the repositories:
//
//   node profile/collect.mjs [folder]        folder defaults to C:/Code
//   node profile/collect.mjs --report        also prints per-repository numbers (not written)
//
// What is written is aggregate only: counts per day, per hour, per language and per tool. The
// only names in the file are the projects in PROJECTS below, which the site already names.
// No path, address or commit subject leaves the machine.
//
// Definitions, so the README can state them:
//   commit     a non-merge commit on main, master, stage or the branch checked out, whose
//              author address is the owner's. Counted once even when two clones hold it.
//              Commits that exist only on other branches are not counted.
//   own repo   a repository where the owner wrote at least 60% of the commits that people wrote
//              (bots and coding agents are left out of that share).
//   line       a non-blank line in a tracked source file of an own repo, as checked out today.
//              Lock files, generated files, vendored code, design exports, agent work folders,
//              data and notebooks are not source.
//   tool       counted once per own repo whose manifests name it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../site/src/data/site.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const report = args.includes('--report');
const root = args.find((a) => !a.startsWith('--')) ?? 'C:/Code';
const WEEKS = 53;

const mine = (email) =>
  email === site.email || email.endsWith(`+${site.github.handle}@users.noreply.github.com`);
const machine = (email) => /noreply@anthropic\.com$|\[bot\]@|^bot@|github-actions/.test(email);

// Folder name to the name the site uses. Everything else is counted under "Everything else".
const PROJECTS = {
  'ozu-aps': 'APS',
  temizelisg: 'Temizel İSG',
  me2exp: 'me2exp',
  'talk-tracks': 'Talk Tracks',
  'baby-tell': 'BabyTell',
  'notification-system': 'Notification system',
};
const OTHER = 'Everything else';

const LANGS = {
  TypeScript: ['ts', 'tsx', 'mts', 'cts'],
  JavaScript: ['js', 'jsx', 'mjs', 'cjs'],
  Vue: ['vue'],
  Astro: ['astro'],
  Python: ['py'],
  Rust: ['rs'],
  Go: ['go'],
  Kotlin: ['kt', 'kts'],
  SQL: ['sql'],
  CSS: ['css', 'scss'],
  HTML: ['html'],
  Shell: ['sh', 'ps1', 'bash'],
  'C and C++': ['c', 'cc', 'cpp', 'h', 'hpp'],
  Java: ['java'],
  'C#': ['cs'],
  Markdown: ['md', 'mdx'],
};
const EXT = Object.fromEntries(
  Object.entries(LANGS).flatMap(([lang, exts]) => exts.map((e) => [e, lang])),
);
const NOT_SOURCE =
  /(^|\/)(\.agents|\.claude|node_modules|dist|build|out|vendor|vendored|third_party|target|coverage|__snapshots__|generated|\.yarn|\.venv|venv|site-packages|fixtures|testdata|upstream|external)\/|\.min\.|\.d\.ts$|\.gen\.|\.generated\.|(^|\/)(database|supabase)\.types\.ts$|\.snap$|-lock\.|\.lock$|\.dc\.html$|(^|\/)api-types\.ts$/i;

// A tool is "used" by a repository when one of its manifests names one of these packages.
const TOOLS = {
  TypeScript: ['typescript'],
  Vite: ['vite'],
  Vitest: ['vitest'],
  Playwright: ['@playwright/test', 'playwright'],
  Zod: ['zod'],
  'Vue': ['vue'],
  React: ['react'],
  Astro: ['astro'],
  Hono: ['hono'],
  NestJS: ['@nestjs/core'],
  'Cloudflare Workers': ['wrangler', '@cloudflare/workers-types', '@cloudflare/vite-plugin'],
  Supabase: ['@supabase/supabase-js', 'supabase'],
  Kysely: ['kysely'],
  Tokio: ['tokio'],
  Axum: ['axum'],
  Quinn: ['quinn'],
  Serde: ['serde'],
  PyTorch: ['torch'],
  Transformers: ['transformers'],
  Pydantic: ['pydantic'],
  pytest: ['pytest'],
  'OR-Tools': ['ortools'],
  OpenTelemetry: ['@opentelemetry/api', 'opentelemetry-api', 'opentelemetry', 'go.opentelemetry.io/otel'],
};
// Found by a file rather than a package.
const FILE_TOOLS = {
  Docker: /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml)$/i,
  'GitHub Actions': /^\.github\/workflows\/[^/]+\.ya?ml$/,
  PostgreSQL: null, // set from manifests and SQL below
};

const git = (dir, a) =>
  execFileSync('git', ['-C', dir, ...a], {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
const tryGit = (dir, a) => {
  try {
    return git(dir, a);
  } catch {
    return '';
  }
};

const today = new Date();
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// The window ends on the Sunday of this week and starts on a Monday, 53 weeks earlier.
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
const start = new Date(end);
start.setDate(start.getDate() - WEEKS * 7 + 1);
const startKey = dayKey(start);
const todayKey = dayKey(today);

const seen = new Set();
const days = {}; // date -> { project: commits }
const punch = Array.from({ length: 7 }, () => Array(24).fill(0)); // Monday first
const lines = {};
const changed = { added: 0, removed: 0 };
const tools = {};
const perRepo = [];
let ownRepos = 0;
let reposInWindow = 0;

const repos = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, '.git')))
  .map((d) => d.name);

for (const name of repos) {
  const dir = path.join(root, name);
  const refs = ['main', 'master', 'stage'].filter((r) =>
    tryGit(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${r}`]).trim(),
  );
  // Some repositories keep their work on the branch that is checked out, not on main.
  if (!tryGit(dir, ['rev-parse', '--verify', '--quiet', 'HEAD']).trim()) continue;
  refs.push('HEAD');

  const log = git(dir, ['log', ...refs, '--no-merges', '--format=%H\t%ae\t%aI']);
  let byMe = 0;
  let byPeople = 0;
  let inWindow = 0;
  const myHashes = new Set();
  for (const row of log.split('\n')) {
    if (!row) continue;
    const [hash, email, iso] = row.split('\t');
    if (!machine(email)) byPeople++;
    if (!mine(email)) continue;
    byMe++;
    myHashes.add(hash);
    if (seen.has(hash)) continue;
    seen.add(hash);
    const date = iso.slice(0, 10); // the author's own calendar day
    if (date < startKey || date > todayKey) continue;
    inWindow++;
    const project = PROJECTS[name] ?? OTHER;
    (days[date] ??= {})[project] = (days[date][project] ?? 0) + 1;
    const [y, m, d] = date.split('-').map(Number);
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7;
    punch[weekday][Number(iso.slice(11, 13))]++;
  }
  if (!byMe) continue;
  if (inWindow) reposInWindow++;

  // Lines added and removed by the owner's commits inside the window, source files only.
  let added = 0;
  let removed = 0;
  const stat = git(dir, [
    'log', ...refs, '--no-merges', `--since=${startKey}T00:00:00`, '--numstat', '--format=@%H',
  ]);
  let take = false;
  for (const row of stat.split('\n')) {
    if (row.startsWith('@')) {
      take = myHashes.has(row.slice(1));
      continue;
    }
    if (!take || !row) continue;
    const [a, r, file] = row.split('\t');
    if (a === '-' || !file || NOT_SOURCE.test(file)) continue;
    const lang = EXT[file.split('.').pop().replace(/[}"]$/, '').toLowerCase()];
    if (!lang || lang === 'Markdown') continue;
    added += Number(a);
    removed += Number(r);
  }
  changed.added += added;
  changed.removed += removed;

  const own = byMe / byPeople >= 0.6;
  const repoLines = {};
  const repoTools = new Set();
  if (own) {
    ownRepos++;
    const files = git(dir, ['ls-files', '-z']).split('\0').filter(Boolean);
    const deps = new Set();
    for (const file of files) {
      const base = file.split('/').pop();
      for (const [tool, re] of Object.entries(FILE_TOOLS)) if (re?.test(file)) repoTools.add(tool);
      const full = path.join(dir, file);
      if (/^(package\.json|Cargo\.toml|pyproject\.toml|go\.mod|requirements[^/]*\.txt)$/.test(base)) {
        if (NOT_SOURCE.test(file)) continue;
        let text = '';
        try {
          text = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        if (base === 'package.json') {
          try {
            const pkg = JSON.parse(text);
            for (const k of ['dependencies', 'devDependencies', 'peerDependencies'])
              for (const d of Object.keys(pkg[k] ?? {})) deps.add(d);
          } catch {}
        } else {
          for (const m of text.matchAll(/^\s*["']?([A-Za-z0-9_.\-/@]+)["']?\s*(?:=|[<>~!]=|v\d|$|\[)/gm))
            deps.add(m[1].toLowerCase());
          for (const m of text.matchAll(/["']([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*(?:[<>=~!][^"']*)?["']/g))
            deps.add(m[1].toLowerCase());
        }
        if (/postgres|psycopg|asyncpg|\/pgx\/|"pg"\s*:/i.test(text)) repoTools.add('PostgreSQL');
        continue;
      }
      if (NOT_SOURCE.test(file)) continue;
      const lang = EXT[base.split('.').pop().toLowerCase()];
      if (!lang) continue;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size > 400_000) continue;
      const n = fs.readFileSync(full, 'utf8').split('\n').filter((l) => l.trim()).length;
      repoLines[lang] = (repoLines[lang] ?? 0) + n;
    }
    for (const [tool, names] of Object.entries(TOOLS)) if (names.some((n) => deps.has(n))) repoTools.add(tool);
    if (deps.has('@supabase/supabase-js')) repoTools.add('PostgreSQL');
    for (const [lang, n] of Object.entries(repoLines)) lines[lang] = (lines[lang] ?? 0) + n;
    for (const t of repoTools) tools[t] = (tools[t] ?? 0) + 1;
  }
  perRepo.push({ name, byMe, byPeople, inWindow, own, added, removed, repoLines, tools: [...repoTools] });
}

// One row per week (Monday first), one column per project.
const projects = [...Object.values(PROJECTS), OTHER];
const weeks = [];
const calendar = [];
const cursor = new Date(start);
for (let w = 0; w < WEEKS; w++) {
  const week = { from: dayKey(cursor), commits: Object.fromEntries(projects.map((p) => [p, 0])) };
  for (let d = 0; d < 7; d++) {
    const key = dayKey(cursor);
    const day = days[key] ?? {};
    let total = 0;
    for (const [p, n] of Object.entries(day)) {
      week.commits[p] += n;
      total += n;
    }
    calendar.push(key > todayKey ? null : total);
    cursor.setDate(cursor.getDate() + 1);
  }
  weeks.push(week);
}

const counted = calendar.filter((n) => n !== null);
let streak = 0;
let longest = 0;
for (const n of counted) {
  streak = n ? streak + 1 : 0;
  longest = Math.max(longest, streak);
}
const busiest = Object.entries(days)
  .map(([date, d]) => [date, Object.values(d).reduce((a, b) => a + b, 0)])
  .sort((a, b) => b[1] - a[1])[0];

const { Markdown: markdown = 0, ...code } = lines;
const out = {
  collected: todayKey,
  window: { from: startKey, to: todayKey, days: counted.length },
  commits: {
    window: counted.reduce((a, b) => a + b, 0),
    activeDays: counted.filter(Boolean).length,
    longestStreak: longest,
    busiestDay: { date: busiest[0], commits: busiest[1] },
  },
  repos: { scanned: perRepo.length, own: ownRepos, activeInWindow: reposInWindow },
  projects,
  weeks,
  calendar,
  punch,
  lines: {
    code: Object.fromEntries(Object.entries(code).sort((a, b) => b[1] - a[1])),
    codeTotal: Object.values(code).reduce((a, b) => a + b, 0),
    markdown,
    added: changed.added,
    removed: changed.removed,
  },
  tools: Object.fromEntries(Object.entries(tools).sort((a, b) => b[1] - a[1])),
};
fs.writeFileSync(path.join(here, 'stats.json'), JSON.stringify(out) + '\n');

if (report) {
  for (const r of perRepo.sort((a, b) => b.inWindow - a.inWindow)) {
    const total = Object.entries(r.repoLines).filter(([l]) => l !== 'Markdown').reduce((a, [, n]) => a + n, 0);
    console.log(
      `${r.name.padEnd(26)} mine ${String(r.byMe).padStart(5)}/${String(r.byPeople).padEnd(5)} window ${String(r.inWindow).padStart(5)} ${r.own ? 'own' : '   '} +${r.added} -${r.removed} code ${total} md ${r.repoLines.Markdown ?? 0} | ${r.tools.join(', ')}`,
    );
  }
}
console.log(JSON.stringify({ ...out, weeks: undefined, calendar: undefined, punch: undefined }, null, 1));
