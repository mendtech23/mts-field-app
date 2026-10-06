// the weekly e-mail backup file restores in the app and keeps the photos already on the device
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 300))); if (!c) process.exitCode = 1; };
const mails = await (await fetch('http://localhost:8310/mails')).json();
const bk = mails.reverse().find(x => /weekly backup/.test(x.subject));
ok(!!bk, 'a weekly backup e-mail exists in the mock mailbox');
const json = Buffer.from(bk.attachments[0].content, 'base64').toString('utf8'), data = JSON.parse(json);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const P = await (await b.newContext()).newPage(); const errs = []; P.on('pageerror', e => errs.push(e.message));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2500);
const photos0 = await P.evaluate(async () => { await DB.put('photos', { id: 'keep1', jobId: 'x', data: 'data:image/jpeg;base64,AA', date: new Date().toISOString(), updatedAt: new Date().toISOString() }); return (await DB.all('photos')).length; });
await P.evaluate(j => { window.__f = new File([j], 'mendtech_backup.json', { type: 'application/json' }); restoreBackup(window.__f); }, json); await P.waitForTimeout(600);
await P.click('.modal-back:last-child [data-yes]'); await P.waitForTimeout(1500);
const after = await P.evaluate(async () => ({ inv: S.invoices.length, cust: S.customers.length, photos: (await DB.all('photos')).length, name: S.settings.garageName }));
ok(after.inv === (data.invoices || []).length && after.cust === (data.customers || []).length, 'restored the invoices and customers from the e-mailed file', { after, inv: (data.invoices || []).length });
ok(after.photos === photos0, 'photos on the device were kept (the e-mail backup has none)', after);
ok(!errs.length, 'no page errors', errs);
await b.close();
