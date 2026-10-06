import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 300))); if (!c) process.exitCode = 1; };
const errs = []; const P = await (await b.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); P.on('pageerror', e => errs.push(e.message));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2500);
// a delivered job yesterday so a review item would qualify
await P.evaluate(async () => { const j = S.jobs[0]; j.status = 'Delivered'; j.completed = addDays(today(), -2); await save('jobs', j); });
const count = () => P.evaluate(() => { go('#/reminders'); return new Promise(r => setTimeout(() => r((document.getElementById('view').innerText.match(/Google review/g) || []).length), 400)); });
ok(await count() === 0, 'no review reminders by default (optional)');
await P.evaluate(async () => { S.settings.offers.googleReviewLink = 'https://g.page/r/test/review'; await saveSettings(); });
ok(await count() === 0, 'still none with only a link set');
await P.evaluate(async () => { S.settings.offers.reviewReminders = true; await saveSettings(); });
ok(await count() > 0, 'shown once switched on');
ok(!/add your Google review link/.test(await P.evaluate(() => document.getElementById('view').innerText)), 'no ⚠ warning text');
await P.evaluate(() => { setFilter('settings', 'tab', 'docs'); go('#/settings'); }); await P.waitForTimeout(400);
const has = await P.evaluate(() => !!document.getElementById('of_revon'));
if (!has) { const tabs = await P.evaluate(() => [...document.querySelectorAll('[onclick*=setFilter]')].map(x => x.getAttribute('onclick')).join(' | ')); console.log('tabs', tabs.slice(0, 600)); }
ok(has, 'Settings has the optional tick box');
ok(!errs.length, 'no page errors', errs);
await b.close();
