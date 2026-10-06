import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 300))); if (!c) process.exitCode = 1; };
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
const P = await ctx.newPage(); P.on('pageerror', e => errs.push(e.message));
const MAP = 'https://maps.app.goo.gl/PHDQW2WFtsiGM2tJ9';
// live-style config (brand.mapLink) → migration fills the setting
await P.route('**/new/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.GP_CONFIG = { mode: 'preview', dbName: 'loc-test', brand: { address: 'Industrial Area 2, Sharjah, UAE', mapLink: '${MAP}' } };` }));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2000);
await P.evaluate(() => typeof loadDemoData === 'function' && !S.jobs.length ? loadDemoData() : null); await P.waitForTimeout(2500);
let st = await P.evaluate(() => ({ map: S.settings.mapLink, schema: S.settings.schema, ready: S.settings.templates.ready, booking: S.settings.templates.booking }));
ok(await P.evaluate(() => garageMapLink()) === MAP, 'fresh install uses the link from config', { g: await P.evaluate(() => garageMapLink()), schema: st.schema, map: st.map });
const up = await P.evaluate(async () => { const s = S.settings; delete s.mapLink; s.schema = 36;
  s.templates.ready = s.templates.ready.replace('\n{directions}', ''); s.templates.booking = 'My own text. Location: {address}\nBye'; s.templates.needsWorkshop = 'Edited, no address line';
  await migrateSettings(); return { map: s.mapLink, schema: s.schema, ready: s.templates.ready.includes('{directions}'), booking: s.templates.booking, nw: s.templates.needsWorkshop }; });
ok(up.map === MAP && up.schema >= 37 && up.ready && up.booking === 'My own text. Location: {address}\n{directions}\nBye' && up.nw === 'Edited, no address line', 'upgrade: link saved, own template text kept, directions added only where the address line is', up);
ok(st.ready.includes('{directions}') && st.booking.includes('{directions}'), 'templates carry {directions}');
const msg = await P.evaluate(() => { const j = S.jobs[0]; return fillTemplate(S.settings.templates.ready, baseCtx(vehicleOf(j), customerOf(j))); });
ok(msg.includes('📍 Directions: ' + MAP), '"car ready" message has the directions link', msg);
await P.evaluate(() => { setFilter('settings', 'tab', 'garage'); go('#/settings'); }); await P.waitForTimeout(600);
ok(await P.inputValue('#s_mapLink').catch(e => e.message) === MAP, 'Settings → Garage details shows the link', await P.inputValue('#s_mapLink').catch(e => e.message.slice(0,200)));
// a document: HTML footer QR and PDF link
const inv = await P.evaluate(() => { const i = S.invoices[0]; return docHTML('invoice', i); });
ok(/Find us/.test(inv) && /<svg/.test(inv.split('Find us')[0].slice(-30000)), 'invoice footer: Find us QR', inv.slice(-1500));
await P.evaluate(h => { const d = document.getElementById('printRoot'); d.style.cssText = 'display:block;position:fixed;inset:0;z-index:9999;overflow:auto;background:#ccc;padding:10px'; d.innerHTML = h; }, inv);
await P.waitForTimeout(500); await (await P.$('#printRoot > div')).screenshot({ path: '/tmp/pgt/t/loc/inv.png' });
await P.evaluate(() => { const d = document.getElementById('printRoot'); d.removeAttribute('style'); d.innerHTML = ''; });
const pdfInfo = await P.evaluate(async () => { const f = await pdfFile('invoice', S.invoices[0]); const u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { link: s.includes('maps.app.goo.gl/PHDQW2WFtsiGM2tJ9'), size: u.length, b64: btoa(s) }; });
ok(pdfInfo.link, 'invoice PDF has the clickable map link');
fs.writeFileSync('/tmp/pgt/t/loc/inv.pdf', Buffer.from(pdfInfo.b64, 'base64'));
// poster
const poster = await P.evaluate(() => { let h = ''; const o = window.printHTML; window.printHTML = x => { h = x; }; printBookingPoster(); window.printHTML = o; return h; });
ok(/Find our workshop/.test(poster), 'QR poster has the find-us QR');
// clearing the setting removes everything cleanly
await P.evaluate(() => { S.settings.mapLink = ''; CFG.brand.mapLink = ''; });
const m2 = await P.evaluate(() => { const j = S.jobs[0]; return fillTemplate(S.settings.templates.ready, baseCtx(vehicleOf(j), customerOf(j))); });
ok(!/Directions/.test(m2) && !/\n\n\n/.test(m2), 'no link set → no empty line left', m2);
// booking page
const ctx2 = await b.newContext(); const B2 = await ctx2.newPage(); B2.on('pageerror', e => errs.push(e.message));
await B2.route('**/new/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.GP_CONFIG = { mode: 'live', supabaseUrl: 'http://localhost:9', supabaseKey: 'x', garageId: 'g', brand: { name: 'MendTech Auto', address: 'Industrial Area 2, Sharjah, UAE', mapLink: '${MAP}', whatsapp: '971522338499', services: ['Battery'], workshopServices: ['Service'] } };` }));
await B2.setViewportSize({ width: 390, height: 844 });
await B2.goto('http://localhost:8099/new/book.html'); await B2.waitForTimeout(1200);
ok(await B2.evaluate(() => document.querySelector('#footTxt a') && document.querySelector('#footTxt a').href) === MAP, 'booking page footer: Find our workshop link');
ok(await B2.evaluate(() => document.getElementById('dirLink').classList.contains('hidden')), 'directions hidden for "we come to you"');
await B2.click('[data-type=workshop]'); await B2.waitForTimeout(300);
ok(await B2.evaluate(() => !document.getElementById('dirLink').classList.contains('hidden') && document.getElementById('dirLink').href), 'directions shown for workshop visit');
await B2.screenshot({ path: '/tmp/pgt/t/loc/book.png', fullPage: true });
ok(await B2.evaluate(() => document.documentElement.scrollWidth <= 392), 'booking page fits a phone');
ok(!errs.length, 'no page errors', errs);
await b.close();
