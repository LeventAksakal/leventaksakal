// Scans the git repositories in a folder and writes profile/stats.json, the numbers behind the
// profile README. Run by hand on the machine that holds the repositories:
//
//   node profile/collect.mjs [folder]        folder defaults to C:/Code
//   node profile/collect.mjs --report        also prints per-repository numbers (not written)
//
// What is written is aggregate only: commits per week and project, and lines per language. The
// only names in the file are the projects in PROJECTS below, which the site already names.
// No path, address, commit subject or time of day leaves the machine.
//
// Definitions, so the README can state them:
//   commit     a non-merge commit on main, master, stage or the branch checked out, whose
//              author address is the owner's. Counted once even when two clones hold it.
//              Commits that exist only on other branches are not counted.
//   own repo   a repository where the owner wrote at least 60% of the commits that people wrote
//              (bots and coding agents are left out of that share).
//   line       a non-blank line in a tracked source file of an own repo, as checked out today.
//              Lock files, generated files, vendored code, design exports, agent work folders,
//              data, notebooks and Markdown are not source.

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
};
const EXT = Object.fromEntries(
  Object.entries(LANGS).flatMap(([lang, exts]) => exts.map((e) => [e, lang])),
);
const NOT_SOURCE =
  /(^|\/)(\.agents|\.claude|node_modules|dist|build|out|vendor|vendored|third_party|target|coverage|__snapshots__|generated|\.yarn|\.venv|venv|site-packages|fixtures|testdata|upstream|external)\/|\.min\.|\.d\.ts$|\.gen\.|\.generated\.|(^|\/)(database|supabase)\.types\.ts$|\.snap$|-lock\.|\.lock$|\.dc\.html$|(^|\/)api-types\.ts$/i;

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
const lines = {};
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
  for (const row of log.split('\n')) {
    if (!row) continue;
    const [hash, email, iso] = row.split('\t');
    if (!machine(email)) byPeople++;
    if (!mine(email)) continue;
    byMe++;
    if (seen.has(hash)) continue;
    seen.add(hash);
    const date = iso.slice(0, 10); // the author's own calendar day
    if (date < startKey || date > todayKey) continue;
    inWindow++;
    const project = PROJECTS[name] ?? OTHER;
    (days[date] ??= {})[project] = (days[date][project] ?? 0) + 1;
  }
  if (!byMe) continue;
  if (inWindow) reposInWindow++;

  const own = byMe / byPeople >= 0.6;
  const repoLines = {};
  if (own) {
    ownRepos++;
    for (const file of git(dir, ['ls-files', '-z']).split('\0')) {
      if (!file || NOT_SOURCE.test(file)) continue;
      const lang = EXT[file.split('.').pop().toLowerCase()];
      if (!lang) continue;
      const full = path.join(dir, file);
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
    for (const [lang, n] of Object.entries(repoLines)) lines[lang] = (lines[lang] ?? 0) + n;
  }
  perRepo.push({ name, byMe, byPeople, inWindow, own, repoLines });
}

// One row per week (Monday first), one column per project.
const projects = [...Object.values(PROJECTS), OTHER];
const weeks = [];
let commits = 0;
let activeDays = 0;
let countedDays = 0;
const cursor = new Date(start);
for (let w = 0; w < WEEKS; w++) {
  const week = { from: dayKey(cursor), commits: Object.fromEntries(projects.map((p) => [p, 0])) };
  for (let d = 0; d < 7; d++) {
    const key = dayKey(cursor);
    if (key <= todayKey) {
      countedDays++;
      const day = Object.entries(days[key] ?? {});
      if (day.length) activeDays++;
      for (const [p, n] of day) {
        week.commits[p] += n;
        commits += n;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  weeks.push(week);
}

const out = {
  collected: todayKey,
  window: { from: startKey, to: todayKey, days: countedDays },
  commits: { window: commits, activeDays },
  repos: { scanned: perRepo.length, own: ownRepos, activeInWindow: reposInWindow },
  projects,
  weeks,
  lines: {
    code: Object.fromEntries(Object.entries(lines).sort((a, b) => b[1] - a[1])),
    codeTotal: Object.values(lines).reduce((a, b) => a + b, 0),
  },
};
fs.writeFileSync(path.join(here, 'stats.json'), JSON.stringify(out) + '\n');

if (report) {
  for (const r of perRepo.sort((a, b) => b.inWindow - a.inWindow)) {
    const total = Object.values(r.repoLines).reduce((a, n) => a + n, 0);
    console.log(
      `${r.name.padEnd(26)} mine ${String(r.byMe).padStart(5)}/${String(r.byPeople).padEnd(5)} window ${String(r.inWindow).padStart(5)} ${r.own ? 'own' : '   '} lines ${total}`,
    );
  }
}
console.log(JSON.stringify({ ...out, weeks: undefined }, null, 1));
