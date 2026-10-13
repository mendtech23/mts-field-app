// Test web server for the browser test suites (tests/app/*.mjs): http://localhost:8099/new/index.html
// · /new/*  → the app straight from the repo's garagepro/ folder (always the current code, no copy step)
// · /new/js/config.js → a local test config (offline mode, same brand as the preview site, no cloud)
// · anything else → /tmp/pgt (e.g. /l2app for the Level 2 cloud e2e, made by stack/app-copy.sh)
// Start:  node garagepro-cloud/tests/stack/serve-app.mjs &      (port 8099; exits quietly if already running)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../../garagepro');
const OTHER = '/tmp/pgt';
const PORT = Number(process.env.GP_TEST_PORT || 8099);
fs.mkdirSync(OTHER, { recursive: true });   // tests also write screenshots there

// test config = the preview config without the cloud
const testConfig = () => {
  const src = fs.readFileSync(path.resolve(here, '../../preview/config.js'), 'utf8');
  const json = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  const cfg = JSON.parse(json);
  Object.assign(cfg, { mode: 'preview', dbName: 'garagepro-preview', supabaseUrl: '', supabaseKey: '', garageId: '' });
  delete cfg.previewCloud;
  return `/* local test config (serve-app.mjs) */\nwindow.GP_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
};

// the security headers the live site sends (from garagepro/_headers, "/*" block)
const headers = {};
try {
  let cur = null;
  for (const l of fs.readFileSync(path.join(APP, '_headers'), 'utf8').split('\n')) {
    if (/^\//.test(l)) { cur = l.trim(); headers[cur] = {}; }
    else if (cur && /^\s+\S/.test(l)) { const i = l.indexOf(':'); headers[cur][l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  }
} catch { /* no _headers: serve without them */ }

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const isApp = u.startsWith('/new/');
  if (isApp && u === '/new/js/config.js') {
    r.writeHead(200, { 'Content-Type': TYPES['.js'], ...(headers['/*'] || {}) });
    return r.end(testConfig());
  }
  const root = isApp ? APP : OTHER, rel = isApp ? u.slice(4) : u, f = path.join(root, rel);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', ...(isApp ? headers['/*'] || {} : {}) });
  if (q.method === 'HEAD') return r.end();
  fs.createReadStream(f).on('error', () => r.end()).pipe(r);
});
server.on('error', e => { if (e.code === 'EADDRINUSE') { console.log(`test server already running on :${PORT}`); process.exit(0); } throw e; });
server.listen(PORT, () => console.log(`GaragePro test server: http://localhost:${PORT}/new/index.html (app from ${APP})`));
