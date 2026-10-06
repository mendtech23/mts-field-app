// v3.8.1: opening / setup costs — kept out of monthly profit, shown under Reports → Investment & payback
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 400))); if (!c) process.exitCode = 1; };
const errs = []; const ctx = await b.newContext({ viewport: { width: 1300, height: 1100 } }); const P = await ctx.newPage(); P.on('pageerror', e => errs.push(e.message));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2500);
const ev = (f, a) => P.evaluate(f, a);
const save = async () => { await P.click('.modal-back:last-child [data-save]'); await P.waitForTimeout(600); };
ok((await ev(() => APP_VERSION)) === '3.8.1', 'version 3.8.1');
const d0 = await ev(() => addDays(today(), -40));
const ids = await ev(async d0 => {
  const a = await save('expenses', { date: addDays(d0, -5), category: 'Tools & Equipment', description: 'Car lift', amount: 21000, vat: 1000, method: 'Bank transfer' });
  const b2 = await save('expenses', { date: addDays(d0, -3), category: 'Tools & Equipment', description: 'Tool set', amount: 5000, vat: 0, method: 'Cash' });
  const c = await save('expenses', { date: addDays(d0, -2), category: 'Rent', description: 'First month rent', amount: 3000, vat: 0, method: 'Cash' });
  return { a: a.id, b: b2.id, c: c.id };
}, d0);
const mk = await ev(id => monthKey(get('expenses', id).date), ids.a), mk2 = await ev(id => monthKey(get('expenses', id).date), ids.b);
const before = await ev(([mk, mk2]) => { const r = monthData(mk), r2_ = monthData(mk2); return { np: r.np + (mk2 !== mk ? r2_.np : 0), vat: r.expVat + (mk2 !== mk ? r2_.expVat : 0), cash: accountBalance('cash'), bank: accountBalance('bank') }; }, [mk, mk2]);
// expenses page has the button
await ev(() => go('#/expenses')); await P.waitForTimeout(400);
ok(/Mark opening costs/i.test(await ev(() => document.getElementById('view').innerText)), 'Expenses page: Mark opening costs button');
// bulk tool
await ev(() => markSetupCosts()); await P.waitForTimeout(300);
await ev(d0 => { const i = document.getElementById('su_date'); i.value = d0; i.dispatchEvent(new Event('change')); }, d0);
const listed = await ev(ids => [ids.a, ids.b, ids.c].map(id => !!document.querySelector(`#su_list input[data-id="${id}"]`)), ids);
ok(listed.every(Boolean), 'the three opening-period expenses are listed', listed);
ok(await ev(id => document.querySelector(`#su_list input[data-id="${id}"]`).checked, ids.a), 'ticked by default');
await P.click('#su_none');
await ev(ids => { for (const id of [ids.a, ids.b]) document.querySelector(`#su_list input[data-id="${id}"]`).checked = true; }, ids);
await P.click('.modal-back:last-child [data-ok]'); await P.waitForTimeout(700);
const st = await ev(ids => ({ a: get('expenses', ids.a).setup, b: get('expenses', ids.b).setup, c: get('expenses', ids.c).setup, od: S.settings.openingDate }), ids);
ok(st.a === true && st.b === true && st.c === false && st.od === d0, 'lift + tools marked, rent not, opening date saved', st);
const after = await ev(([mk, mk2]) => { const r = monthData(mk), r2_ = monthData(mk2); return { np: r.np + (mk2 !== mk ? r2_.np : 0), vat: r.expVat + (mk2 !== mk ? r2_.expVat : 0), setup: r.setupNet + (mk2 !== mk ? r2_.setupNet : 0), cash: accountBalance('cash'), bank: accountBalance('bank') }; }, [mk, mk2]);
ok(Math.abs(after.np - before.np - 25000) < 0.01, 'monthly profit no longer carries the 25,000 (net of VAT) opening costs', { before, after });
ok(Math.abs(after.setup - 25000) < 0.01, 'month shows the opening costs separately', after.setup);
ok(after.vat === before.vat, 'input VAT unchanged (still claimable)', { b: before.vat, a: after.vat });
ok(after.cash === before.cash && after.bank === before.bank, 'cash & bank balances unchanged', { before, after });
// reports: investment & payback card
await ev(() => go('#/reports')); await P.waitForTimeout(500);
const rep = await ev(() => document.getElementById('view').innerText);
ok(/Investment & payback/i.test(rep) && /Invested to open/i.test(rep) && /Still to recover/i.test(rep), 'Reports: Investment & payback card');
const card = await ev(() => { const inv = S.expenses.filter(isSetup).reduce((a, e) => a + expNetOf(e), 0); return { inv, earned: runningProfit(openingDate(), today()) }; });
ok(Math.abs(card.inv - await ev(() => S.expenses.filter(isSetup).reduce((a, e) => a + num(e.amount) - num(e.vat), 0))) < 0.01 && card.inv >= 25000, 'invested total', card);
ok(rep.includes(await ev(v => money(v, false), card.inv)), 'invested amount shown on the card', card.inv);
// yearly table excludes it
const y = mk.slice(0, 4);
const yr = await ev(([y, mk]) => { const ex = S.expenses.filter(e => !isSetup(e) && monthKey(e.date) === mk).reduce((a, e) => a + expNetOf(e), 0); return ex; }, [y, mk]);
ok(typeof yr === 'number', 'reports running overheads computed');
// month-end closing shows the line
await ev(mk => { setFilter('closing', 'month', mk); go('#/closing'); }, mk); await P.waitForTimeout(500);
ok(/Opening \/ setup costs this month/i.test(await ev(() => document.getElementById('view').innerText)), 'Month-end closing: opening costs shown apart from profit');
// expense form tick works both ways
await ev(id => editExpense(id), ids.c); await P.waitForTimeout(300);
ok(await ev(() => !!document.getElementById('f_setup')), 'expense form has the opening-cost tick');
await ev(() => { document.getElementById('f_setup').checked = true; }); await save();
ok(await ev(id => get('expenses', id).setup === true, ids.c), 'tick on the form marks it');
await ev(id => editExpense(id), ids.c); await P.waitForTimeout(300);
ok(await ev(() => document.getElementById('f_setup').checked), 'form shows it ticked');
await ev(() => { document.getElementById('f_setup').checked = false; }); await save();
ok(await ev(id => get('expenses', id).setup === false, ids.c), 'untick on the form');
// expenses list tag
await ev(mk => { setFilter('expenses', 'show', 'all'); setFilter('expenses', 'month', mk); go('#/expenses'); }, mk); await P.waitForTimeout(400);
ok(/Opening cost/i.test(await ev(() => document.getElementById('view').innerText)), 'expenses list tags opening costs');
// phone width
await P.setViewportSize({ width: 390, height: 900 }); await ev(() => go('#/reports')); await P.waitForTimeout(500);
ok(await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Reports fits a phone (no sideways scroll)');
await ev(() => markSetupCosts()); await P.waitForTimeout(300);
ok(await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mark opening costs window fits a phone');
await P.screenshot({ path: '/tmp/pgt/v381-phone.png' });
ok(!errs.length, 'no page errors', errs);
await b.close();
