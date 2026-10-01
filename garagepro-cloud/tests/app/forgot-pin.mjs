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
ok(await P.evaluate(async () => !!(await Cloud.rpc('get_my_lock_pin'))), 'PIN saved in the cloud');
// lock the app and use "Forgot PIN?"
await P.evaluate(() => { closeAllModals(); showCloudLock(); }); await P.waitForTimeout(500);
ok(!!(await P.$('#lk_forgot')), 'lock screen shows Forgot PIN?');
await P.click('#lk_forgot'); await P.waitForTimeout(1500);
ok(!!(await P.$('#cl_user')), 'goes to the password sign-in');
await P.fill('#cl_user', email); await P.fill('#cl_pass', pass); await P.click('#cl_go'); await P.waitForTimeout(2500);
if (await P.$('#cd_in')) { await P.fill('#cd_in', totp(secret)); await P.click('#cd_go'); await P.waitForTimeout(3000); }
ok(!!(await P.$('#lp_1')), 'asked to choose a NEW PIN (old one not restored)');
await P.fill('#lp_1', '554433'); await P.fill('#lp_2', '554433'); await P.click('.modal [data-yes]'); await P.waitForTimeout(2500);
await P.evaluate(() => showCloudLock()); await P.waitForTimeout(400);
await P.fill('#lk_in', '918273'); await P.click('#lk_go'); await P.waitForTimeout(1200);
ok(!!(await P.$('#lockScreen')), 'old PIN no longer works');
await P.fill('#lk_in', '554433'); await P.click('#lk_go'); await P.waitForTimeout(1200);
ok(!(await P.$('#lockScreen')), 'new PIN unlocks');
// another (wiped) device gets the NEW PIN from the cloud
const gid = await P.evaluate(() => Cloud.me.garage_id); const cfg2 = cfgTxt.replace(/garageId:\s*'[^']*'/, "garageId: '" + gid + "'");
const c2 = await b.newContext(); await c2.route('**/l2app/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: cfg2 }));
await c2.addInitScript(() => { try { localStorage.setItem('gp_preview_seeded', '1'); } catch (e) { } });
const Q = await c2.newPage(); await Q.goto('http://localhost:8099/l2app/index.html'); await Q.waitForTimeout(3000);
await Q.fill('#cl_user', email); await Q.fill('#cl_pass', pass); await Q.click('#cl_go'); await Q.waitForTimeout(2500);
if (await Q.$('#cd_in')) { await Q.waitForTimeout(31000); await Q.fill('#cd_in', totp(secret)); await Q.click('#cd_go'); await Q.waitForTimeout(3500); }
ok(!(await Q.$('#lp_1')), 'second device: no PIN question');
await Q.evaluate(() => showCloudLock()); await Q.waitForTimeout(400);
await Q.fill('#lk_in', '554433'); await Q.click('#lk_go'); await Q.waitForTimeout(1200);
ok(!(await Q.$('#lockScreen')), 'second device unlocks with the NEW PIN');
await b.close();
