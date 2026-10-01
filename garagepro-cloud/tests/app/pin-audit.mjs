// v3.6: the screen PIN follows the person to a new / wiped device, the "browser keeps forgetting you" tip, audit log clean-up from the UI.
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
console.log('pin in cloud:', await P.evaluate(async () => !!(await Cloud.rpc('get_my_lock_pin'))));
const errs = [];
async function freshDevice(n) {
  const c = await b.newContext({ viewport: { width: 1300, height: 900 } });
  await c.addInitScript(() => { try { localStorage.setItem('gp_preview_seeded', '1'); } catch (e) { } });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8099/l2app/index.html'); await p.waitForTimeout(2500);
  const first = await p.evaluate(() => ({ login: !!document.getElementById('cl_user'), lock: !!document.getElementById('lockScreen') }));
  if (!first.login) { await p.evaluate(() => { setFilter('settings', 'tab', 'cloud'); go('#/settings'); }); await p.waitForTimeout(400); await p.fill('#sy_email', email); await p.fill('#sy_pass', pass); await p.evaluate(() => cloudSignIn(false)); }
  else { await p.fill('#cl_user', email); await p.fill('#cl_pass', pass); await p.click('#cl_go'); }
  await p.waitForTimeout(2500);
  if (await p.$('#cd_in')) { await p.fill('#cd_in', totp(secret)); await p.click('#cd_go'); await p.waitForTimeout(3500); }
  const st = await p.evaluate(() => ({ pinAsked: !!document.getElementById('lp_1'), pinStored: !!lsGet('gp_lock_' + (Auth.user || {}).id), forgetful: /keeps forgetting/.test((document.querySelector('.modal') || {}).innerText || ''), user: Auth.user && Auth.user.role, toasts: [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' | ') }));
  console.log(`device ${n}:`, JSON.stringify(first), JSON.stringify(st));
  return p;
}
await freshDevice(2);
await freshDevice(3);
const p3 = await freshDevice(4);
// lock and unlock device 3 with the PIN chosen on device 1
await p3.evaluate(() => { document.querySelectorAll('.modal-back').forEach(x => x.remove()); Auth.lock ? Auth.lock() : showCloudLock(); }); await p3.waitForTimeout(800);
if (!(await p3.$('#lk_in'))) await p3.evaluate(() => showCloudLock());
await p3.fill('#lk_in', '918273'); await p3.click('#lk_go'); await p3.waitForTimeout(1500);
console.log('device 3 unlocked with device-1 PIN:', await p3.evaluate(() => !document.getElementById('lockScreen') && !!Auth.user));
// audit clean-up from the UI
await p3.evaluate(() => { setFilter('settings', 'tab', 'staff'); go('#/settings'); }); await p3.waitForTimeout(3000);
console.log('audit controls:', await p3.evaluate(() => !!document.querySelector('[onclick="purgeAudit()"]') && !!document.querySelector('[onchange^="saveAuditKeep"]')));
await p3.evaluate(() => purgeAudit()); await p3.waitForTimeout(300); await p3.click('.modal [data-yes]'); await p3.waitForTimeout(2000);
console.log('after delete:', await p3.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' | ')));
await p3.selectOption('[onchange^="saveAuditKeep"]', '90'); await p3.waitForTimeout(1500);
console.log('keep:', await p3.evaluate(async () => await Cloud.rpc('get_audit_keep')));
await p3.evaluate(() => saveAuditKeep(''));
await p3.setViewportSize({ width: 390, height: 800 }); await p3.waitForTimeout(500);
console.log('phone width ok:', await p3.evaluate(() => document.documentElement.scrollWidth <= 392));
console.log('page errors:', errs.slice(0, 3));
await b.close();
