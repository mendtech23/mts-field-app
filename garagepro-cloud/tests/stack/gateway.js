// Local Supabase stand-in for testing ONLY: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST subset, /functions/v1 -> Deno.
const http = require('http'), crypto = require('crypto'), { Pool } = require('pg');
const SECRET = process.env.JWT_SECRET;
const pool = new Pool({ connectionString: 'postgres://authenticator:restpw@localhost:5432/sb', max: 10 });
const FN_PORTS = JSON.parse(process.env.FN_PORTS || '{}');
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function verify(tok) {
  const [h, p, s] = (tok || '').split('.');
  if (!s) return null;
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest());
  if (sig !== s) return null;
  const c = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  if (c.exp && c.exp < Date.now() / 1000) return 'expired';
  return c;
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-supabase-api-version', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range, x-supabase-api-version' };
function send(res, code, body, extra = {}) { res.writeHead(code, { 'Content-Type': 'application/json', ...CORS, ...extra }); res.end(body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body)); }
function proxy(req, res, port, path, body) {
  const h = { ...req.headers }; delete h.host;
  const p = http.request({ host: '127.0.0.1', port, path, method: req.method, headers: h }, r => {
    const hh = { ...r.headers }; for (const k of Object.keys(hh)) if (k.startsWith('access-control-')) delete hh[k]; Object.assign(hh, CORS); res.writeHead(r.statusCode, hh); r.pipe(res);
  });
  p.on('error', e => send(res, 502, { message: 'upstream ' + e.message }));
  p.end(body);
}
const qid = s => '"' + String(s).replace(/"/g, '""') + '"';
function parseVal(v) { return v; }
function where(params, vals) {
  const out = [];
  for (const [k, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = raw.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s); if (!m) continue;
    const [, not, op, v] = m; let sql;
    if (op === 'in') { const items = v.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')); sql = `${qid(k)}::text = any($${vals.push(items)})`; }
    else if (op === 'is') sql = `${qid(k)} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : 'false'}`;
    else { const o = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op]; sql = `${qid(k)} ${o} $${vals.push(op.endsWith('like') ? v.replace(/\*/g, '%') : v)}`; }
    out.push(not ? `not (${sql})` : sql);
  }
  return out.length ? ' where ' + out.join(' and ') : '';
}
async function rest(req, res, url, body) {
  const auth = (req.headers.authorization || '').replace(/^Bearer /i, '') || req.headers.apikey;
  const claims = verify(auth);
  if (!claims) return send(res, 401, { code: 'PGRST301', message: 'JWT invalid' });
  if (claims === 'expired') return send(res, 401, { code: 'PGRST303', message: 'JWT expired' });
  const role = claims.role || 'anon';
  const seg = url.pathname.replace(/^\/rest\/v1\//, '').split('/');
  const params = [...url.searchParams.entries()];
  const prefer = req.headers.prefer || '';
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${qid(role)}`);
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.headers', $3, true), set_config('request.method', $4, true)`,
      [JSON.stringify(claims), claims.sub || '', JSON.stringify({ 'x-forwarded-for': req.headers['x-forwarded-for'] || '127.0.0.1', 'user-agent': req.headers['user-agent'] || '' }), req.method]);
    let out, isNullRpc = false;
    if (seg[0] === 'rpc') {
      const fn = seg[1], args = body ? JSON.parse(body) : {};
      const meta = (await c.query(`select p.proretset, t.typname, t.typtype, p.prorettype = 'void'::regtype as isvoid from pg_proc p join pg_type t on t.oid=p.prorettype join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1 limit 1`, [fn])).rows[0];
      if (!meta) { await c.query('rollback'); return send(res, 404, { code: 'PGRST202', message: `function ${fn} not found` }); }
      const keys = Object.keys(args), vals = keys.map(k => args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]);
      const call = `public.${qid(fn)}(${keys.map((k, i) => `${qid(k)} => $${i + 1}`).join(', ')})`;
      if (meta.proretset || meta.typname === 'record') out = (await c.query(`select * from ${call}`, vals)).rows;
      else if (meta.typtype === 'c') { out = (await c.query(`select * from ${call}`, vals)).rows[0] || null; isNullRpc = out === null; }
      else { const r = (await c.query(`select ${call} as v`, vals)).rows[0]; out = meta.isvoid ? null : r.v; isNullRpc = !meta.isvoid && out === null; if (typeof out === 'string') out = JSON.stringify(out); }
    } else {
      const table = qid(seg[0]), vals = [];
      if (req.method === 'GET') {
        const sel = (url.searchParams.get('select') || '*').split(',').map(s => s === '*' ? '*' : qid(s)).join(',');
        let sql = `select ${sel} from public.${table}${where(params, vals)}`;
        const ord = url.searchParams.get('order'); if (ord) sql += ' order by ' + ord.split(',').map(o => { const [col, dir] = o.split('.'); return `${qid(col)} ${dir === 'desc' ? 'desc' : 'asc'}`; }).join(',');
        if (url.searchParams.get('limit')) sql += ` limit ${parseInt(url.searchParams.get('limit'))}`;
        if (url.searchParams.get('offset')) sql += ` offset ${parseInt(url.searchParams.get('offset'))}`;
        out = (await c.query(sql, vals)).rows;
      } else if (req.method === 'POST') {
        let rows = JSON.parse(body || '[]'); if (!Array.isArray(rows)) rows = [rows];
        const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
        const conflict = url.searchParams.get('on_conflict'), merge = /resolution=merge-duplicates/.test(prefer), ignore = /resolution=ignore-duplicates/.test(prefer);
        out = [];
        for (const r of rows) {
          const v = cols.map(k => r[k] !== null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]);
          let sql = `insert into public.${table} (${cols.map(qid).join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`;
          if (conflict && merge) sql += ` on conflict (${conflict.split(',').map(qid).join(',')}) do update set ${cols.map(k => `${qid(k)} = excluded.${qid(k)}`).join(',')}`;
          else if (ignore) sql += ' on conflict do nothing';
          sql += ' returning *';
          out.push(...(await c.query(sql, v)).rows);
        }
      } else if (req.method === 'PATCH') {
        const r = JSON.parse(body || '{}'), cols = Object.keys(r);
        cols.forEach(k => vals.push(r[k] !== null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]));
        const w = where(params, vals);
        out = (await c.query(`update public.${table} set ${cols.map((k, i) => `${qid(k)} = $${i + 1}`).join(',')}${w} returning *`, vals)).rows;
      } else if (req.method === 'DELETE') {
        out = (await c.query(`delete from public.${table}${where(params, vals)} returning *`, vals)).rows;
      }
    }
    await c.query('commit');
    if (/return=minimal/.test(prefer) && seg[0] !== 'rpc') return send(res, 201, null);
    send(res, 200, isNullRpc ? 'null' : out);
  } catch (e) {
    await c.query('rollback').catch(() => {});
    const code = e.code === '42501' ? 403 : e.code === 'P0001' ? 400 : e.code && e.code.startsWith('23') ? 409 : 400;
    send(res, code, { code: e.code, message: e.message, details: e.detail || null, hint: e.hint || null });
  } finally { c.release(); }
}
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);
  const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
    const body = Buffer.concat(chunks), url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/auth/v1/')) return proxy(req, res, 9999, req.url.replace(/^\/auth\/v1/, ''), body);
    if (url.pathname.startsWith('/functions/v1/')) { const name = url.pathname.split('/')[3]; const port = FN_PORTS[name]; if (!port) return send(res, 404, { message: 'no function ' + name }); return proxy(req, res, port, '/' + name + url.search, body); }
    if (url.pathname.startsWith('/rest/v1/')) return rest(req, res, url, body.toString()).catch(e => send(res, 500, { message: e.message }));
    send(res, 404, { message: 'not found' });
  });
}).listen(8200, () => console.log('gateway :8200'));
