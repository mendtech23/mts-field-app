// Sign in once (owner with authenticator), then reopen the app later with an EXPIRED access token.
import crypto from 'crypto'; import fs from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const K = JSON.parse(fs.readFileSync('/tmp/pgt/stack/keys.json', 'utf8'));
function totp(secret) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const ch of secret.replace(/[\s=]/g, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2))); const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(), o = h[19] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
const email = `reopen-${Date.now().toString(36)}@test.local`, pass = 'Reopen#2026';
await fetch('http://localhost:8200/auth/v1/signup', { method: 'POST', headers: { apikey: K.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
const cfgTxt = (await (await fetch('http://localhost:8099/l2app/js/config.js')).text()).replace(/garageId:\s*'[^']*'/, "garageId: '" + crypto.randomUUID() + "'");
await ctx.route('**/l2app/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: cfgTxt }));
await ctx.addInitScript(() => { try { localStorage.setItem('gp_preview_seeded', '1'); } catch (e) { } });
let P = await ctx.newPage(); const logs = []; P.on('console', m => logs.push(m.text().slice(0, 160)));
await P.goto('http://localhost:8099/l2app/index.html'); await P.waitForTimeout(1500);
await P.evaluate(() => { setFilter('settings', 'tab', 'cloud'); go('#/settings'); }); await P.waitForTimeout(400);
await P.fill('#sy_email', email); await P.fill('#sy_pass', pass); await P.evaluate(() => cloudSignIn(false)); await P.waitForTimeout(2500);
await P.evaluate(async () => { await Cloud.rpc('claim_owner'); await Cloud.rpc('set_owner_pin', { p_pin: '246813' }); });
await P.evaluate(() => { window.confirmBox = async () => true; setupAuthenticator(false); }); await P.waitForTimeout(1500);
const secret = await P.evaluate(() => document.querySelector('.modal b.mono').textContent);
await P.fill('#au_c', totp(secret)); await P.click('.modal [data-s]'); await P.waitForTimeout(2500);
await P.fill('#lp_1', '918273'); await P.fill('#lp_2', '918273'); await P.click('.modal [data-yes]'); await P.waitForTimeout(2500);

const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 300))); if (!c) process.exitCode = 1; };
const errs = []; P.on('pageerror', e => errs.push(e.message));
// a delivered job, then ask for feedback
const jid = await P.evaluate(async () => { closeAllModals(); const v = await save('vehicles', { plate: 'FB 1', make: 'Toyota', model: 'Camry', customerId: (await save('customers', { name: 'Feed Back', phone: '0501234567' })).id });
  const j = await save('jobs', { number: 'JC-FB1', date: today(), vehicleId: v.id, customerId: v.customerId, status: 'Delivered', completed: today(), items: [] }); return j.id; });
await P.evaluate(async () => { S.settings.offers.googleReviewLink = 'https://g.page/r/test/review'; await saveSettings(); });
await P.evaluate(id => askFeedback(id), jid); await P.waitForTimeout(800);
const msg = await P.evaluate(() => (document.querySelector('.modal-back:last-child textarea') || {}).value || '');
const tok = (msg.match(/feedback\.html#([A-Za-z0-9_-]+)/) || [])[1];
ok(!!tok, 'feedback message has the private link', msg.slice(0, 200));
await P.evaluate(() => closeAllModals());
await P.evaluate(async () => { await Sync.syncNow(); }); await P.waitForTimeout(1500);
// the customer opens it on their phone
const ctxC = await b.newContext({ viewport: { width: 390, height: 800 } }); await ctxC.route('**/l2app/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: cfgTxt }));
const C = await ctxC.newPage(); C.on('pageerror', e => errs.push('customer page: ' + e.message));
await C.goto('http://localhost:8099/l2app/feedback.html#' + tok); await C.waitForTimeout(1500);
ok(/How did we do/.test(await C.evaluate(() => document.body.innerText)) && /JC-FB1/.test(await C.evaluate(() => document.body.innerText)), 'customer page shows the job');
await C.click('#st button[data-n="5"]'); await C.fill('#cm', 'Very good service'); await C.click('#go'); await C.waitForTimeout(1500);
const ct = await C.evaluate(() => document.body.innerText);
ok(/Thank you/.test(ct) && /Google review/.test(ct), '5 stars → thank you + Google review button', ct.slice(0, 200));
await C.screenshot({ path: '/tmp/pgt/t/v38/feedback-phone.png' });
await C.goto('http://localhost:8099/l2app/feedback.html#' + tok); await C.waitForTimeout(1200);
ok(/Thank you/.test(await C.evaluate(() => document.body.innerText)), 'opening again shows it is already answered');
// back in the app: the rating syncs to the job
await P.evaluate(async () => { await Sync.syncNow(); }); await P.waitForTimeout(2500);
const fb = await P.evaluate(id => get('jobs', id).feedback, jid);
ok(fb && fb.rating === 5 && /Very good/.test(fb.comment), 'rating arrives in the app on the job', fb);
await P.evaluate(id => go('#/job/' + id), jid); await P.waitForTimeout(600);
{ const vt = await P.evaluate(() => document.getElementById('view').innerHTML); ok(/Customer rating/.test(vt) && /Very good service/.test(vt), 'job page shows the rating and comment', (vt.match(/Quality.{0,400}/s) || [''])[0]); }
// close the day with the report
await P.evaluate(() => go('#/money')); await P.waitForTimeout(400);
await P.evaluate(() => closeDay()); await P.waitForTimeout(300);
await P.evaluate(() => { document.getElementById('f_counted').value = '0'; });
await P.click('.modal-back:last-child [data-save]'); await P.waitForTimeout(2500);
const tt = await P.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText).join(' | '));
ok(/Day report e-mailed/.test(tt), 'closing the day e-mails the Owner day report', tt);
// cloud space in Settings → Staff & security
await P.evaluate(() => { setFilter('settings', 'tab', 'staff'); go('#/settings'); }); await P.waitForTimeout(3000);
ok(/Cloud space: .*MB of 500 MB/.test(await P.evaluate(() => (document.getElementById('cloudSpace') || {}).innerText || '')), 'Settings shows cloud space used', await P.evaluate(() => (document.getElementById('cloudSpace') || {}).innerText));
ok(!!(await P.$('#al_backup')), 'weekly backup tick box');
ok(!errs.length, 'no page errors', errs);
await b.close();
