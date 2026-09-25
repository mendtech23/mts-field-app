// Edge function tests (login, staff-admin, notify) against the local stand-in. pg_net is simulated: queued calls in net.calls are replayed.
import crypto from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(process.env.PG_MODULES || import.meta.url);
const { Client } = require('pg');
const K = JSON.parse(fs.readFileSync(process.env.KEYS || '/tmp/pgt/stack/keys.json', 'utf8'));
const B = process.env.GATEWAY || 'http://localhost:8200', MAIL = process.env.MOCKMAIL || 'http://localhost:8310';
const db = new Client({ connectionString: process.env.DB_URL || 'postgres://postgres:pgpw@localhost:5432/sb' });
await db.connect();
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const run = Date.now().toString(36);
async function http(method, path, { token, body, key = K.anon, headers = {} } = {}) {
  const r = await fetch(B + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json', 'x-forwarded-for': '10.1.1.1', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, data: j };
}
const rpc = (token, fn, args = {}) => http('POST', '/rest/v1/rpc/' + fn, { token, body: args });
const fn = (name, body, token) => http('POST', '/functions/v1/' + name, { token, body });
const login = (l, p) => fn('login', { login: l, password: p });
const mails = async () => (await fetch(MAIL + '/mails')).json();
async function pgNet() {   // what pg_net would do: deliver queued calls
  const { rows } = await db.query('delete from net.calls returning url, body, headers'); const out = [];
  for (const c of rows) { const r = await fetch(c.url.replace(/^https?:\/\/[^/]+/, B), { method: 'POST', headers: c.headers, body: JSON.stringify(c.body) }); out.push(r.status); }
  return out;
}
function totp(secret) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const ch of secret.replace(/=+$/, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(), o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
await fetch(MAIL + '/mails', { method: 'DELETE' }); await db.query('delete from net.calls');

console.log('\n1. Owner');
const email = `boss-${run}@test.local`;
await http('POST', '/auth/v1/signup', { body: { email, password: 'Owner#12345' } });
let r = await login(email, 'Owner#12345'); ok(r.status === 200 && r.data.session.access_token && r.data.role === 'owner', 'owner signs in with e-mail through the login function', r.data);
let O = r.data.session.access_token; const G = JSON.parse(Buffer.from(O.split('.')[1], 'base64url')).sub;
await rpc(O, 'claim_owner');
r = await rpc(O, 'set_alert_config', { p_email: 'mendtech23@gmail.com', p_functions_url: 'http://localhost:8200/functions/v1', p_anon_key: K.anon }); ok(r.status === 200, 'alert e-mail set');
r = await fn('staff-admin', { action: 'list' }, O); ok(r.status === 403 && /MFA_REQUIRED/.test(r.data.error), 'staff admin refused until the authenticator app is set up', r.data);
const fac = (await http('POST', '/auth/v1/factors', { token: O, body: { factor_type: 'totp' } })).data;
const ch = (await http('POST', `/auth/v1/factors/${fac.id}/challenge`, { token: O })).data;
O = (await http('POST', `/auth/v1/factors/${fac.id}/verify`, { token: O, body: { challenge_id: ch.id, code: totp(fac.totp.secret) } })).data.access_token;
ok(!!O, 'owner now at password + code');

console.log('\n2. Staff admin');
const u1 = 'sam' + run.slice(-4), u2 = 'ravi' + run.slice(-4);
r = await fn('staff-admin', { action: 'create', username: u1, name: 'Sam', role: 'advisor', password: 'Sam12345' }, O); ok(r.status === 200 && r.data.role === 'advisor' && r.data.username === u1, 'create advisor login', r.data);
const samId = r.data.user_id;
r = await fn('staff-admin', { action: 'create', username: u2.toUpperCase(), name: 'Ravi', role: 'technician', tech_id: 't1', password: 'Ravi12345' }, O); ok(r.status === 200 && r.data.username === u2, 'create technician (username stored lower-case)', r.data);
const raviId = r.data.user_id;
r = await fn('staff-admin', { action: 'create', username: u1, name: 'Sam 2', role: 'advisor', password: 'Sam12345' }, O); ok(r.status === 400 && /taken/.test(r.data.error), 'duplicate username refused', r.data);
r = await fn('staff-admin', { action: 'create', username: 'a b', name: 'X', role: 'advisor', password: 'Sam12345' }, O); ok(r.status === 400, 'username with space refused');
r = await fn('staff-admin', { action: 'create', username: 'weak' + run.slice(-4), name: 'X', role: 'advisor', password: '1234' }, O); ok(r.status === 400 && /8 characters/.test(r.data.error), 'weak password refused');
r = await fn('staff-admin', { action: 'create', username: 'boss' + run.slice(-4), name: 'X', role: 'owner', password: 'Sam12345' }, O); ok(r.status === 400, 'cannot create a second Owner');
r = await fn('staff-admin', { action: 'create', username: 'tech' + run.slice(-4), name: 'X', role: 'technician', password: 'Sam12345' }, O); ok(r.status === 400 && /Link/.test(r.data.error), 'technician must be linked to a technician record');
r = await fn('staff-admin', { action: 'list' }, O); ok(r.status === 200 && r.data.length === 3 && r.data[0].role === 'owner', 'list: owner + 2 staff', r.data);
r = await fn('staff-admin', { action: 'update', user_id: r.data[0].user_id, role: 'advisor' }, O); ok(r.status === 400, 'owner row cannot be changed here');

console.log('\n3. Staff sign-in');
r = await login(u1, 'Sam12345'); ok(r.status === 200 && r.data.role === 'advisor', 'advisor signs in with username', r.data);
let S = r.data.session;
r = await rpc(S.access_token, 'whoami'); ok(r.data.role === 'advisor' && r.data.garage_id === G && r.data.name === 'Sam', 'session belongs to the garage as Sam');
r = await fn('staff-admin', { action: 'list' }, S.access_token); ok(r.status === 403, 'advisor cannot manage staff');
r = await login(u1.toUpperCase(), 'Sam12345'); ok(r.status === 200, 'username is not case-sensitive');
r = await login('owner', 'Owner#12345'); ok(r.status === 200 && r.data.role === 'owner', 'owner can also use username "owner"');
for (let i = 1; i <= 3; i++) r = await login(u1, 'wrong' + i);
ok(r.status === 401 && r.data.left === 2 && /2 tries left/.test(r.data.message), '3rd wrong password → "2 tries left"', r.data);
await login(u1, 'wrong4'); r = await login(u1, 'wrong5'); ok(r.status === 429 && r.data.minutes === 15, '5th wrong → locked 15 min', r.data);
r = await login(u1, 'Sam12345'); ok(r.status === 429, 'right password refused while locked');
r = await login('nobody' + run, 'x'); ok(r.status === 401 && /Wrong username or password/.test(r.data.message), 'unknown user gets the same answer (no hints)', r.data);
await db.query("delete from app.login_fails where key = $1", ['id:' + samId]);
let al = (await db.query('select level, kind, text from public.alerts where garage_id=$1 order by id', [G])).rows;
ok(al.some(a => a.level === 'alert' && /Sam \(advisor\) locked for 15 min/.test(a.text)), 'lockout alert names the person', al.map(a => a.text));
ok(al.some(a => /3 wrong passwords for Sam/.test(a.text)), '3 wrong passwords → warning');

console.log('\n4. Switch off / reset / sign out');
await rpc(S.access_token, 'device_hello', { p_label: 'Front desk PC', p_ua: 'x' });
r = await fn('staff-admin', { action: 'update', user_id: samId, active: false }, O); ok(r.status === 200 && r.data.active === false, 'switch Sam off', r.data);
r = await rpc(S.access_token, 'whoami'); ok(r.data.role === null, 'Sam is cut off immediately', r.data);
r = await http('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: S.refresh_token } }); ok(!r.data.access_token, 'Sam cannot refresh the session', r.data);
r = await login(u1, 'Sam12345'); ok(r.status === 403 && r.data.error === 'OFF', 'Sam cannot sign in: "switched off"', r.data);
r = await fn('staff-admin', { action: 'update', user_id: samId, active: true, role: 'manager', name: 'Sam K' }, O); ok(r.status === 200 && r.data.role === 'manager', 'switch back on as Manager');
r = await login(u1, 'Sam12345'); ok(r.status === 200 && r.data.role === 'manager', 'Sam signs in again (now Manager)', r.data);
const R = (await login(u2, 'Ravi12345')).data.session; await rpc(R.access_token, 'device_hello', { p_label: 'Ravi phone', p_ua: 'x' });
r = await fn('staff-admin', { action: 'password', user_id: raviId, password: 'short' }, O); ok(r.status === 400, 'reset refuses weak password');
r = await fn('staff-admin', { action: 'password', user_id: raviId, password: 'NewRavi2026' }, O); ok(r.status === 200 && r.data.signed_out === 1, 'password reset signs Ravi out (1 device)', r.data);
r = await rpc(R.access_token, 'crew_pull'); ok(r.status >= 400, 'old Ravi session no longer works');
r = await login(u2, 'Ravi12345'); ok(r.status === 401, 'old password refused');
r = await login(u2, 'NewRavi2026'); ok(r.status === 200, 'new password works');
r = await fn('staff-admin', { action: 'signout', user_id: raviId }, O); ok(r.status === 200, 'sign Ravi out everywhere');
r = await fn('staff-admin', { action: 'list' }, 'not-a-token'); ok(r.status >= 400, 'bad token refused');

console.log('\n5. E-mail alerts');
const st = await pgNet(); ok(st.length > 3 && st.every(s => s === 200), `pg_net delivered ${st.length} instant e-mails`, st);
let m = await mails(); ok(m.length === st.length && m.every(x => x.to[0] === 'mendtech23@gmail.com' && x.auth === 'Bearer re_test_key'), 'all to mendtech23@gmail.com via Resend', m.map(x => x.to));
ok(m.some(x => /🔴.*locked for 15 min/.test(x.subject)), 'lockout e-mail subject has 🔴', m.map(x => x.subject));
ok(m.some(x => /New advisor login created: Sam/.test(x.subject)), 'new login e-mail');
ok(m.every(x => /mendtech/.test(x.html) && /Dubai/.test(x.html)), 'branded, Dubai time');
const aid = (await db.query("select id from public.alerts where garage_id=$1 and level='alert' order by id limit 1", [G])).rows[0].id;
r = await fn('notify', { alert_id: aid }); ok(r.data.skipped === true, 'same alert is never e-mailed twice');
const info = (await db.query("select id from public.alerts where garage_id=$1 and level='info' limit 1", [G])).rows[0];
if (info) { r = await fn('notify', { alert_id: info.id }); ok(r.data.skipped === true, 'info alerts wait for the daily summary'); }

console.log('\n6. Daily summary');
r = await fn('notify', { daily: true }); ok(r.status === 403, 'daily summary needs the cron secret');
r = await fn('notify', { daily: true }, undefined);
const secret = (await db.query("select value from app.config where key='cron_secret'")).rows[0].value;
await db.query("delete from app.config where key like 'summary%'");
await fetch(MAIL + '/mails', { method: 'DELETE' });
await db.query('select app.daily_ping()');
const q = (await db.query('select headers from net.calls')).rows; ok(q.length === 1 && q[0].headers['x-cron-secret'] === secret, 'cron job queues the summary with the secret');
await pgNet(); m = await mails(); const mine = m.find(x => /daily summary/.test(x.subject) && /Who changed what/.test(x.html));
ok(mine && /Who changed what/.test(mine.html) && /Alerts/.test(mine.html), 'summary e-mail sent with alerts + changes', m.map(x => x.subject));
ok(mine && /🔴/.test(mine.subject), 'serious day → 🔴 in the subject');
fs.writeFileSync('/tmp/pgt/l2/daily.html', mine ? mine.html : '');
r = await http('POST', '/functions/v1/notify', { body: { daily: true }, headers: { 'x-cron-secret': secret } }); ok(r.data.sent === 0, 'only one summary per day');

console.log(`\n${pass} passed, ${fail} failed`);
await db.end(); process.exit(fail ? 1 : 0);
