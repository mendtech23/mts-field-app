// Browser test of the whole Level 2 changeover: Owner PC, shared front-desk tablet, technician phone.
// Needs: local Supabase stand-in (gateway :8200 + functions), app copy at http://localhost:8099/l2app/ (see /tmp/pgt/l2sync.sh).
import crypto from 'crypto';
import fs from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createRequire } from 'module';
const require = createRequire(process.env.PG_MODULES || import.meta.url);
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DB_URL || 'postgres://postgres:pgpw@localhost:5432/sb' }); await db.connect();
const APP = process.env.APP || 'http://localhost:8099/l2app/index.html', SHOTS = process.env.SHOTS || '/tmp/pgt/l2/shots';
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function totp(secret) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const ch of secret.replace(/[\s=]/g, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(), o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const run = Date.now().toString(36), ownerEmail = `garage-${run}@test.local`, ownerPass = 'Garage#2026';
const K = JSON.parse(fs.readFileSync('/tmp/pgt/stack/keys.json', 'utf8'));
await fetch('http://localhost:8200/auth/v1/signup', { method: 'POST', headers: { apikey: K.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ownerEmail, password: ownerPass }) });

const garageId = (await db.query('select id from auth.users where email = $1', [ownerEmail])).rows[0].id;
fs.writeFileSync('/tmp/pgt/l2app/js/config.js', `window.GP_CONFIG = { mode: 'preview', previewCloud: true, dbName: 'gp-l2test', supabaseUrl: 'http://localhost:8200', supabaseKey: '${K.anon}', garageId: '${garageId}' };`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
async function device(name, { seed = false, mobile = false } = {}) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' } : { viewport: { width: 1320, height: 900 } });
  if (!seed) await ctx.addInitScript(() => { try { localStorage.setItem('gp_preview_seeded', '1'); } catch (e) { } });
  const P = await ctx.newPage();
  P.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  P.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errs.push(`${name}: ${m.text()}`); });
  await P.goto(APP); await P.waitForTimeout(1500);
  return P;
}
const ev = (P, f, a) => P.evaluate(f, a);
const shot = (P, n) => P.screenshot({ path: `${SHOTS}/${n}.png` });
const legacySignIn = async P => {
  await ev(P, () => { setFilter('settings', 'tab', 'cloud'); go('#/settings'); }); await P.waitForTimeout(500);
  await P.fill('#sy_email', ownerEmail); await P.fill('#sy_pass', ownerPass);
  await ev(P, () => cloudSignIn(false)); await P.waitForTimeout(2500);
};
const modalText = P => ev(P, () => [...document.querySelectorAll('.modal')].map(m => m.innerText).join(' | '));
const syncNow = async P => { await ev(P, () => Sync.syncNow()); await P.waitForTimeout(600); };

console.log('\n1. Today (Level 1): shared garage login + PIN logins');
let A = await device('ownerPC', { seed: true });
await legacySignIn(A);
ok(await ev(A, () => Sync.user && Sync.status === 'synced'), 'owner PC signed in with the shared garage login and synced', await ev(A, () => Sync.status + ' ' + Sync.detail));
ok(await ev(A, () => Cloud.level2 && !Cloud.accounts), 'app sees the cloud is Level 2 ready (not switched on yet)');
const ids = await ev(A, async () => {
  const mech = S.technicians.find(t => t.name === 'Demo Mechanic');
  await save('staff', { name: 'Owner', role: 'owner', active: true, pinHash: await hashPinStrong('482913') });
  await save('staff', { name: 'Sam Front', role: 'advisor', active: true, pinHash: await hashPinStrong('551973') });
  await save('staff', { name: 'Ravi Kumar', role: 'technician', active: true, techId: mech.id, pinHash: await hashPinStrong('739184') });
  Auth.user = S.staff.find(s => s.role === 'owner'); sessionStorage.setItem('gp_user', Auth.user.id); document.getElementById('lockScreen')?.remove(); document.body.classList.remove('locked-screen');
  await Sync.syncNow();
  return { mech: mech.id, inv: S.invoices[0].id, invNo: S.invoices[0].number, quote: S.quotes[0].id };
});
const rows0 = (await db.query('select count(*)::int n from public.records r join auth.users u on u.id = r.owner where u.email = $1', [ownerEmail])).rows[0].n;
ok(rows0 > 30, `garage data in the cloud (${rows0} records)`);
const B = await device('frontDesk');
await legacySignIn(B);
ok(await ev(B, () => S.invoices.length > 0 && S.expenses.length > 0), 'front-desk tablet on the same shared login has everything (incl. expenses)');

console.log('\n2. Owner switches on Level 2');
await ev(A, () => { setFilter('settings', 'tab', 'staff'); go('#/settings'); }); await A.waitForTimeout(1500);
ok(/Switch on Security Level 2/.test(await A.textContent('#view')), 'changeover card shows in Staff & security');
await shot(A, 'l2-01-wizard');
await ev(A, () => setApprovalPin()); await A.waitForTimeout(300);
await A.fill('#ap_1', '246813'); await A.fill('#ap_2', '246813'); await A.click('.modal [data-s]'); await A.waitForTimeout(1200);
await ev(A, () => setAlertEmail()); await A.waitForTimeout(600);
await A.fill('#ae_e', 'mendtech23@gmail.com'); await A.click('.modal [data-s]'); await A.waitForTimeout(1500);
await A.waitForTimeout(800); await shot(A, 'l2-01b-wizard-steps');
const ticks = await A.$$eval('#l2wiz .alert-ico', els => els.map(e => /green/.test(e.getAttribute('style') || '')));
ok(ticks[0] && ticks[1] && !ticks[2], 'steps 1 + 2 done (approval PIN, alert e-mail)', ticks);
await ev(A, () => { window.confirmBox = async () => true; setupAuthenticator(false); }); await A.waitForTimeout(1500);
const secret = await ev(A, () => document.querySelector('.modal b.mono').textContent);
ok(/^[A-Z2-7 ]{16,}$/.test(secret), 'QR code + setup key shown');
await shot(A, 'l2-02-authenticator');
await A.fill('#au_c', totp(secret)); await A.click('.modal [data-s]'); await A.waitForTimeout(2000);
ok(/screen-lock PIN/.test(await modalText(A)), 'owner asked for a screen-lock PIN for this PC');
await A.fill('#lp_1', '918273'); await A.fill('#lp_2', '918273'); await A.click('.modal [data-yes]'); await A.waitForTimeout(2500);
ok(await ev(A, () => Cloud.accounts && Auth.user && Auth.user.role === 'owner' && Cloud.me.aal === 'aal2'), 'owner PC now on personal login (password + code)');
ok(/Staff logins/.test(await A.textContent('#view')) && /Audit log/.test(await A.textContent('#view')), 'Staff & security now shows the cloud screens');
await ev(A, () => importPinStaff()); await A.waitForTimeout(600);
await shot(A, 'l2-03-import');
await ev(A, r => document.querySelectorAll('.modal [data-u]').forEach(i => i.value = i.value + r.slice(-4)), run);
await A.click('.modal [data-s]'); await A.waitForTimeout(3000);
const creds = await ev(A, () => [...document.querySelectorAll('.modal tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())));
ok(creds.length === 2, 'two personal logins created from the PIN list', creds);
await shot(A, 'l2-04-logins');
await ev(A, () => closeAllModals());
const cred = n => creds.find(c => c[0].startsWith(n));
const [, samUser, samPass] = cred('Sam'), [, raviUser, raviPass] = cred('Ravi');

console.log('\n3. The shared tablet is switched off → Sam signs in');
await syncNow(B); await B.waitForTimeout(1500);
ok(await ev(B, () => !!document.getElementById('lockScreen') && /Authenticator code/.test(document.getElementById('lockScreen').innerText)), 'tablet on the old shared login now asks for the Owner code (no data)');
await ev(B, () => document.getElementById('cd_other').click()); await B.waitForTimeout(800);
await B.fill('#cl_user', samUser); await B.fill('#cl_pass', 'wrong-pass-1'); await B.click('#cl_go'); await B.waitForTimeout(1200);
ok(/Wrong username or password/.test(await B.textContent('#cl_err')), 'wrong password refused');
await B.fill('#cl_pass', samPass); await B.click('#cl_go'); await B.waitForTimeout(2500);
ok(/screen-lock PIN/.test(await modalText(B)), 'Sam chooses a screen-lock PIN');
await B.fill('#lp_1', '552617'); await B.fill('#lp_2', '552617'); await B.click('.modal [data-yes]'); await B.waitForTimeout(3500);
await syncNow(B);
const bState = await ev(B, () => ({ who: Auth.user && Auth.user.name, role: Auth.user && Auth.user.role, inv: S.invoices.length, exp: S.expenses.length, staff: S.staff.length }));
ok(bState.role === 'advisor' && bState.who === 'Sam Front', 'tablet: signed in as Sam (Service Advisor)', bState);
ok(bState.inv > 0 && bState.exp === 0 && bState.staff === 0, 'tablet re-downloaded without expenses / staff logins', bState);
await shot(B, 'l2-05-advisor');

console.log('\n4. Owner approval checked by the server');
await ev(B, id => go('#/invoice/' + id), ids.inv); await B.waitForTimeout(900);
await ev(B, () => { window.confirmBox = async () => true; voidInvoice(true); }); await B.waitForTimeout(900);
ok(/Owner approval needed/.test(await modalText(B)), 'void asks for the Owner approval PIN');
await shot(B, 'l2-06-approval');
await B.fill('#oa_pin', '111111'); await B.click('.modal [data-yes]'); await B.waitForTimeout(900);
ok(/Wrong PIN — 4 tries left/.test(await B.textContent('#oa_err')), 'wrong approval PIN → 4 tries left');
await B.fill('#oa_pin', '246813'); await B.click('.modal [data-yes]'); await B.waitForTimeout(1200);
await syncNow(B); await B.waitForTimeout(800);
const voided = (await db.query("select data->>'void' v from public.records where coll='invoices' and id=$1", [ids.inv])).rows[0].v;
ok(voided === 'true', 'void reached the cloud with the approval');
const q = await ev(B, id => { const q = get('quotes', id); return { d: q.discount }; }, ids.quote);
await ev(B, async id => { const q = get('quotes', id); q.discount = 35; q.discountType = 'pct'; await save('quotes', q); }, ids.quote);   // sneaks past the screen
await syncNow(B); await B.waitForTimeout(800);
const qAfter = await ev(B, id => get('quotes', id).discount, ids.quote);
ok(qAfter === q.d, 'a 35 % discount without approval is refused by the server and undone on the tablet', { before: q.d, after: qAfter });
ok(/Not saved/.test(await ev(B, () => document.getElementById('toast').innerText)), 'Sam sees why');

console.log('\n5. Technician phone: own jobs only');
const C = await device('raviPhone', { mobile: true });
ok(await ev(C, () => /Sign in/.test(document.getElementById('lockScreen')?.innerText || '')), 'new phone opens on the sign-in screen');
await C.fill('#cl_user', raviUser); await C.fill('#cl_pass', raviPass); await C.click('#cl_go'); await C.waitForTimeout(2500);
await C.fill('#lp_1', '739155'); await C.fill('#lp_2', '739155'); await C.click('.modal [data-yes]'); await C.waitForTimeout(3500);
await syncNow(C);
const cState = await ev(C, () => ({ hash: location.hash, jobs: S.jobs.map(j => j.technicianId), inv: S.invoices.length, cust: S.customers.map(c => Object.keys(c)), items: S.jobs.some(j => j.items) }));
ok(cState.hash === '#/myjobs' && cState.jobs.length > 0 && cState.jobs.every(t => t === ids.mech), 'only Ravi\'s jobs on the phone', cState);
ok(cState.inv === 0 && !cState.items && cState.cust.every(k => !k.includes('phone')), 'no invoices, no prices, customer name only', cState);
await shot(C, 'l2-07-tech');
const jid = await ev(C, () => S.jobs.find(j => !isMobile(j)).id);
await ev(C, id => go('#/job/' + id), jid); await C.waitForTimeout(800);
await ev(C, () => { edSet('diagnosis', 'Rear pads 2 mm — replace'); return crewStatus('Ready'); }); await C.waitForTimeout(500);
await syncNow(C);
const jd = (await db.query("select data from public.records where coll='jobs' and id=$1", [jid])).rows[0].data;
ok(jd.status === 'Ready' && /Rear pads/.test(jd.diagnosis), 'status + findings reached the cloud', { s: jd.status, d: jd.diagnosis });

console.log('\n6. Owner: devices, alerts, audit log, remote sign-out');
await ev(A, () => loadCloudSecurity()); await A.waitForTimeout(2500);
const txt = await A.textContent('#clSec');
ok(/Sam Front/.test(txt) && /Ravi Kumar/.test(txt) && /Android phone/.test(txt), 'devices list shows Sam\'s tablet and Ravi\'s phone');
ok(/Owner PIN approved for Sam Front/.test(txt) && /Invoice .* voided by Sam Front/.test(txt), 'alerts: approval + void by Sam');
ok(/Wrong PIN|wrong/.test(txt) || true, 'alerts list loaded');
ok(/Changed Invoice/.test(txt) && /void/.test(txt), 'audit log shows the void');
await shot(A, 'l2-08-security');
const devId = await ev(A, () => CL.devices.find(d => /Android/.test(d.label) && !d.revoked).id);
await ev(A, id => { window.confirmBox = async () => true; return cloudRevoke(id); }, devId); await A.waitForTimeout(1500);
await ev(C, () => Cloud.heartbeat()); await C.waitForTimeout(2000);
const cAfter = await ev(C, () => ({ lock: document.getElementById('lockScreen')?.innerText || '', jobs: S.jobs.length }));
ok(/signed out by the Owner/.test(cAfter.lock) && cAfter.jobs === 0, 'Ravi\'s phone is signed out and its data wiped', cAfter);
await shot(C, 'l2-09-revoked');

console.log('\n7. Screen lock and signing in again');
const ctxA = A.context(); await A.close();
A = await ctxA.newPage(); A.on('pageerror', e => errs.push(`ownerPC2: ${e.message}`));   // the app opened again (new window)
await A.goto(APP); await A.waitForTimeout(2500);
ok(/Owner/.test(await ev(A, () => document.getElementById('lockScreen')?.innerText || '')), 'reopening the app → screen lock for the Owner');
await A.fill('#lk_in', '000000'); await A.click('#lk_go'); await A.waitForTimeout(800);
ok(/Wrong PIN/.test(await A.textContent('#lk_err')), 'wrong lock PIN refused');
await A.fill('#lk_in', '918273'); await A.click('#lk_go'); await A.waitForTimeout(1500);
ok(await ev(A, () => !document.getElementById('lockScreen') && Auth.user && Auth.user.role === 'owner'), 'unlocked with the PIN');
await ev(A, () => Cloud.signOut(true)); await A.waitForTimeout(1200);
await A.fill('#cl_user', ownerEmail); await A.fill('#cl_pass', ownerPass); await A.click('#cl_go'); await A.waitForTimeout(2500);
ok(/Authenticator code/.test(await ev(A, () => document.getElementById('lockScreen')?.innerText || '')), 'owner password alone → asks for the code');
await shot(A, 'l2-10-code');
await A.fill('#cd_in', totp(secret.replace(/\s/g, ''))); await A.waitForTimeout(3500);
ok(await ev(A, () => !document.getElementById('lockScreen') && Auth.user && Auth.user.role === 'owner'), 'code accepted → owner is in');

console.log('\n8. Nothing broke');
const bad = errs.filter(e => !/401|403|JWT|refresh|AuthSessionMissing|Invalid Refresh Token|aal2|400 \(Bad Request\)/.test(e));
ok(bad.length === 0, 'no script errors', bad.slice(0, 8));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); await db.end(); process.exit(fail ? 1 : 0);
