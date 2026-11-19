// Shows README.md the way GitHub will, before it is pushed:
//
//   node profile/preview.mjs        then open http://127.0.0.1:8790
//
// The Markdown is rendered by GitHub's own renderer (`gh api markdown`), so what GitHub strips is
// stripped here too, and the SVG files are served with the headers GitHub puts on them (a content
// security policy that forbids everything but inline style). The page follows the light or dark
// setting of the browser, as GitHub's <picture> does.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8790);
const context = execFileSync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { encoding: 'utf8' })
  .trim()
  .replace(/^.*github\.com[:/]/, '')
  .replace(/\.git$/, '');
const types = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const page = (html) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>README preview</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--soft:#59636e;--rule:#d1d9e0;--link:#0969da;--code:#818b981f}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#f0f6fc;--soft:#9198a1;--rule:#3d444d;--link:#4493f8;--code:#656c7633}}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}
main{max-width:846px;margin:0 auto;padding:24px 16px 64px}
h3{font-size:1.25em;font-weight:600;line-height:1.25;margin:24px 0 16px}
p,ul,details{margin:0 0 16px}a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;box-sizing:content-box}sub{font-size:75%;line-height:0;position:relative;vertical-align:baseline;bottom:-.25em}
code{font:85% ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--code);padding:.2em .4em;border-radius:6px}
ul{padding-left:2em}li+li{margin-top:.25em}summary{cursor:pointer}
</style><main>${html}</main>`;

http
  .createServer((q, r) => {
    const url = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (url === '/') {
      // "gfm" with the repository as context is the mode that keeps <picture> whole, as github.com
      // does; plain "markdown" wraps the <img> in a link and the dark source is never chosen.
      // It also turns a line end inside a paragraph into a break, which a README does not, so
      // render.mjs writes every paragraph on one line.
      const html = execFileSync(
        'gh',
        ['api', 'markdown', '-F', 'text=@README.md', '-f', 'mode=gfm', '-f', `context=${context}`],
        { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 },
      );
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return r.end(page(html));
    }
    const file = path.join(repo, url);
    const type = types[path.extname(file)];
    if (!type || !file.startsWith(repo) || !fs.existsSync(file)) {
      r.writeHead(404);
      return r.end();
    }
    r.writeHead(200, {
      'Content-Type': type,
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    r.end(fs.readFileSync(file));
  })
  .listen(port, '127.0.0.1', () => console.log(`README preview on http://127.0.0.1:${port}`));
