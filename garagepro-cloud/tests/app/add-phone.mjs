// Owner adds a second authenticator phone from a password-only (aal1) sign-in: the app asks for the current phone's code first.
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
await P.fill('#lp_1', '918273'); await P.fill('#lp_2', '918273'); await P.click('.modal [data-yes]'); await P.waitForTimeout(2000);
// new sign-in with password only → aal1 session, like a fresh device before the code
await P.evaluate(async ([e, p]) => { await Sync.client.auth.signOut({ scope: 'local' }); await Sync.client.auth.signInWithPassword({ email: e, password: p }); }, [email, pass]);
console.log('aal now:', await P.evaluate(async () => (await Sync.client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel));
const raw = await P.evaluate(async () => { const r = await Sync.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'x' + Date.now() }); return r.error ? r.error.message : 'enrolled'; });
console.log('plain enroll (old behaviour):', raw);
await P.evaluate(() => { document.querySelectorAll('.modal-back,.modal').forEach(x => x.remove()); setupAuthenticator(true); }); await P.waitForTimeout(1200);
console.log('prompt:', (await P.evaluate(() => document.querySelector('.modal').innerText)).replace(/\s+/g, ' ').slice(0, 90));
await P.fill('#cf_c', '000000'); await P.click('.modal [data-s]'); await P.waitForTimeout(1500);
console.log('wrong code:', await P.evaluate(() => document.querySelector('#cf_err').textContent.slice(0, 60)));
await P.waitForTimeout(31000);
await P.fill('#cf_c', totp(secret)); await P.click('.modal [data-s]'); await P.waitForTimeout(2500);
const t2 = await P.evaluate(() => document.querySelector('.modal').innerText.replace(/\s+/g, ' ').slice(0, 60));
console.log('next window:', t2);
const s2 = await P.evaluate(() => document.querySelector('.modal b.mono').textContent);
await P.fill('#au_c', totp(s2)); await P.click('.modal [data-s]'); await P.waitForTimeout(2500);
console.log('factors:', await P.evaluate(async () => (await Sync.client.auth.mfa.listFactors()).data.totp.filter(f => f.status === 'verified').length));
console.log('errors:', logs.filter(l => /error/i.test(l)).slice(0, 3));
await b.close();
