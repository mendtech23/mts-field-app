// v3.8: cash & bank, day close, fixed costs, supplier bills incl. POs and cheques, statements, credit limits, customer credit days,
// fixed-price labour, comebacks, KPI, payments calendar, dashboard banner, phone widths
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 400))); if (!c) process.exitCode = 1; };
const errs = []; const ctx = await b.newContext({ viewport: { width: 1300, height: 1100 } }); const P = await ctx.newPage(); P.on('pageerror', e => errs.push(e.message));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2500);
const ev = (f, a) => P.evaluate(f, a);
const set = async (vals) => ev(v => { for (const [k, x] of Object.entries(v)) { const el = document.getElementById('f_' + k); if (!el) throw new Error('no field ' + k); if (el.type === 'checkbox') el.checked = !!x; else el.value = x; } }, vals);
const save = async () => { await P.click('.modal-back:last-child [data-save]'); await P.waitForTimeout(600); };
const t = await ev(() => today()); const yday = await ev(() => addDays(today(), -1));
ok(await ev(() => APP_VERSION) === '3.8.0' && await ev(() => COLLECTIONS.includes('transfers') && S.transfers !== undefined), 'v3.8.0 with new collections');
// ---- accounts: set real balances, then movements ----
await ev(() => go('#/money')); await P.waitForTimeout(400);
ok(/Cash in hand/i.test(await ev(() => document.getElementById('view').innerText)), 'Cash & bank page opens');
await ev(() => editAccount('cash')); await P.waitForTimeout(300); await set({ opening: 500, openingDate: yday }); await save();
await ev(() => editAccount('bank')); await P.waitForTimeout(300); await set({ opening: 10000, openingDate: yday }); await save();
const bal0 = await ev(() => ({ cash: accountBalance('cash'), bank: accountBalance('bank') }));
ok(bal0.cash === 500 && bal0.bank === 10000, 'real balances set', bal0);
// a cash sale today 160 → cash 660
await ev(async () => { const i = S.invoices[0]; await save('payments', { invoiceId: i.id, customerId: i.customerId, amount: 160, method: 'Cash', date: today(), number: 'R-T1' }); });
ok(await ev(() => accountBalance('cash')) === 660, 'cash sale goes into cash in hand');
// deposit 100 to bank
await ev(() => moneyTransfer('deposit')); await P.waitForTimeout(300); await set({ amount: 100 }); await save();
const bal1 = await ev(() => ({ cash: accountBalance('cash'), bank: accountBalance('bank') }));
ok(bal1.cash === 560 && bal1.bank === 10100, 'bank deposit moves cash to bank', bal1);
// float 60, close the day: counted 550 (10 short), deposit suggested 490
await ev(async () => { moneySettings().cashFloat = 60; await saveSettings(); });
await ev(() => closeDay()); await P.waitForTimeout(300);
await ev(() => { const c = document.getElementById('f_counted'); c.value = '550'; c.dispatchEvent(new Event('input')); });
ok(await ev(() => document.getElementById('f_deposit').value) === '490', 'deposit suggested = counted − float');
await set({ report: false }); await save();
const cu = await ev(() => ({ c: S.cashups.find(x => x.date === today()), cash: accountBalance('cash'), bank: accountBalance('bank') }));
ok(cu.c && cu.c.diff === -10 && cu.c.deposit === 490 && cu.cash === 60 && cu.bank === 10590, 'day closed: 10 short recorded, 490 to bank, 60 float left', cu);
ok(await ev(() => /day report/i.test(dayReportHTML(dayReportData(today()))) || dayReportHTML(dayReportData(today())).includes('Cash count')), 'day report content builds');
// ---- supplier: credit days + limit; PO received on credit; cheque; bounce ----
const supId = await ev(async () => (await save('suppliers', { name: 'Gulf Parts', creditDays: 30, creditLimit: 1000, phone: '0501112233' })).id);
const poId = await ev(async sid => { const p = S.parts[0]; const po = await save('purchaseOrders', { number: 'PO-T1', date: today(), supplierId: sid, status: 'Ordered', items: [{ partId: p.id, desc: p.name, qty: 10, cost: 120 }] }); return po.id; }, supId);
await ev(id => go('#/po/' + id), poId); await P.waitForTimeout(400);
await ev(id => { receivePO(id); }, poId); await P.waitForTimeout(700);
// "different cost?" → no; "Did you pay now?" → Not yet
for (let k = 0; k < 2; k++) { const txt = await ev(() => (document.querySelector('.modal-back:last-child') || {}).innerText || ''); if (!/confirm/i.test(txt)) break; await P.click('.modal-back:last-child [data-no]'); await P.waitForTimeout(700); }
const po = await ev(id => { const o = get('purchaseOrders', id); return { due: o.dueDate, owed: billBalance(billOf(o, 'po')) }; }, poId);
ok(po.owed === 1200 && po.due === await ev(() => addDays(today(), 30)), 'PO on credit: 1200 owed, due in 30 days (supplier terms)', po);
ok(await ev(() => owedToSuppliers()) === 1200 && await ev(() => monthData(monthKey(today())).payablesValue) >= 1200, 'owed to suppliers and month-end include the PO');
await P.waitForTimeout(1200);
const toasts = await ev(() => [...document.querySelectorAll('.toast')].map(x => x.innerText).join(' | '));
ok(/credit limit/.test(toasts), 'over the credit limit warning (1200 > 1000)', toasts);
// pay 700 by post-dated cheque
await ev(id => payBill('po', id), poId); await P.waitForTimeout(300);
await set({ amount: 700, method: 'Cheque', chequeNo: '000123', chequeDate: await ev(() => addDays(today(), 5)) }); await save();
const ch = await ev(id => { const o = get('purchaseOrders', id), b = billOf(o, 'po'); return { owed: billBalance(b), pend: chequesIssued().filter(x => x.p.status === 'Pending').length, bank: accountBalance('bank'), bankLater: accountBalance('bank', addDays(today(), 6)) }; }, poId);
ok(ch.owed === 500 && ch.pend === 1 && ch.bank === 10590 && ch.bankLater === 9890, 'cheque settles 700 now, leaves the bank on its date', ch);
await ev(() => go('#/money')); await P.waitForTimeout(400);
ok(/Cheques given/i.test(await ev(() => document.getElementById('view').innerText)), 'cheque listed on Cash & bank');
ok(/Next 4 weeks/i.test(await ev(() => document.getElementById('view').innerText)), 'payments calendar shows');
await P.click('button:has-text("Bounced")'); await P.waitForTimeout(300); await P.click('.modal-back:last-child [data-yes]'); await P.waitForTimeout(600);
ok(await ev(id => billBalance(billOf(get('purchaseOrders', id), 'po')), poId) === 1200, 'bounced cheque → owed again');
// pay supplier 1200 cash: clears the PO
await ev(sid => paySupplier('s:' + sid), supId); await P.waitForTimeout(300); await set({ method: 'Cash' }); await save();
ok(await ev(() => owedToSuppliers()) === 0 && await ev(id => !!get('purchaseOrders', id).paidDate, poId), 'supplier paid in full; PO marked paid');
ok(await ev(() => accountBalance('cash')) === -1140, 'cash in hand goes down by the payment (and can show negative)');
// statement
await ev(sid => supplierStatement('s:' + sid), supId); await P.waitForTimeout(400);
ok(/STATEMENT/i.test(await ev(() => document.querySelector('.modal-back:last-child .bdoc').innerText)), 'supplier statement document');
await ev(() => closeAllModals());
// ---- fixed costs ----
await ev(() => go('#/fixedcosts')); await P.waitForTimeout(300);
await ev(() => editFixedCost()); await P.waitForTimeout(300);
await set({ name: 'Workshop rent', category: 'Rent', amount: 5000, every: 1, start: await ev(() => today().slice(0, 8) + '01') }); await save();
await ev(() => editFixedCost()); await P.waitForTimeout(300);
await set({ name: 'Trade licence', category: 'Licences & Fees', amount: 12000, every: 12, start: await ev(() => addDays(today(), 120)) }); await save();
let plan = await ev(() => { const p = fixedCostPlan(); return { total: p.total, rem: p.remaining, reserve: p.reserveNow, monthly: p.monthlyEquiv }; });
ok(plan.total === 5000 && plan.rem === 5000 && plan.monthly === 6000, 'month plan: rent due, licence spread (6000 / month)', plan);
ok(plan.reserve > 0 && plan.reserve < 12000, 'licence: amount to have saved by now', plan);
await P.click('button:has-text("Pay")'); await P.waitForTimeout(400);
ok(await ev(() => document.getElementById('f_description').value.startsWith('Workshop rent')), 'Pay opens the expense prefilled');
await set({ method: 'Bank transfer – WIO' }); await save();
plan = await ev(() => { const p = fixedCostPlan(); return { paid: p.paid, rem: p.remaining }; });
ok(plan.paid === 5000 && plan.rem === 0, 'rent paid → nothing left this month', plan);
const fcTxt = await ev(() => document.getElementById('view').innerText);
ok(/Safe to spend/i.test(fcTxt) && /Break-even/i.test(fcTxt), 'safe to spend + break-even shown');
// ---- customer credit days, credit limit note ----
const cid = await ev(async () => { const c = S.customers[0]; c.creditDays = 30; c.creditLimit = 1; await save('customers', c); return c.id; });
const due = await ev(async cid => { const j = S.jobs.find(x => x.customerId === cid) || S.jobs[0]; j.customerId = cid; const inv = await makeInvoiceFromJob(j); return { d: inv.dueDate, want: addDays(today(), 30), id: inv.id }; }, cid);
ok(due.d === due.want, 'invoice due date from customer payment terms', due);
await ev(id => go('#/invoice/' + id), due.id); await P.waitForTimeout(500);
ok(/over their credit limit/i.test(await ev(() => document.getElementById('view').innerText)), 'credit limit warning on the invoice');
// ---- fixed-price labour ----
const lab = await ev(async () => { const q = S.quotes[0]; go('#/quote/' + q.id); await new Promise(r => setTimeout(r, 400));
  const i = q.items.findIndex(x => x.type === 'labour'); edItemType(i, 'labourFixed'); const it = ED.doc.items[i]; await edFlush();
  return { qty: it.qty, fixed: it.fixed, hours: it.hours, html: docHTML('quote', ED.doc), txt: qtyText(it) }; });
ok(lab.fixed && lab.qty === 1 && lab.txt === '1' && !/1 h</.test(lab.html.split('c-q')[1] || ''), 'labour fixed price: shows 1 job, no hours', { q: lab.qty, t: lab.txt, h: lab.hours });
// ---- comeback ----
const jid = await ev(async () => { const v = S.vehicles[0]; const a = S.jobs.find(j => j.vehicleId === v.id) || S.jobs[0];
  const nj = await save('jobs', { number: 'JC-T9', date: today(), vehicleId: a.vehicleId, customerId: a.customerId, status: 'In Progress', items: [] }); return nj.id; });
await ev(id => go('#/job/' + id), jid); await P.waitForTimeout(500);
ok(/Mark as comeback/i.test(await ev(() => document.getElementById('view').innerText)), 'job page shows Quality card');
await ev(() => markComeback()); await P.waitForTimeout(300); await save();
ok(await ev(id => !!get('jobs', id).comebackOf, jid), 'job marked as comeback');
await ev(() => go('#/kpi')); await P.waitForTimeout(500);
const kt = await ev(() => document.getElementById('view').innerText);
ok(/Comebacks/i.test(kt) && /Customer rating/i.test(kt), 'KPI shows comebacks + customer rating');
// ---- dashboard banner (fixed cost due soon) & expenses page ----
await ev(async () => { const f = S.fixedCosts.find(x => x.name === 'Trade licence'); f.start = addDays(today(), 2); await save('fixedCosts', f); });
await ev(() => go('#/dashboard')); await P.waitForTimeout(500);
ok(/To pay in the next 3 days/i.test(await ev(() => document.getElementById('view').innerText)), 'dashboard banner for payments due');
await ev(() => go('#/expenses')); await P.waitForTimeout(400);
ok(!errs.length, 'no page errors so far', errs);
// ---- phone widths ----
await P.setViewportSize({ width: 390, height: 844 });
for (const r of ['#/money', '#/fixedcosts', '#/expenses', '#/suppliers', '#/kpi', '#/job/' + jid, '#/po/' + poId]) { await ev(r => go(r), r); await P.waitForTimeout(400); const w = await ev(() => document.documentElement.scrollWidth); if (w > 392) ok(false, 'phone width ' + r, w); }
await ev(() => go('#/money')); await P.waitForTimeout(300); await P.screenshot({ path: '/tmp/pgt/t/v38/money-phone.png', fullPage: false });
await P.setViewportSize({ width: 1300, height: 1100 }); await ev(() => go('#/money')); await P.waitForTimeout(400); await P.screenshot({ path: '/tmp/pgt/t/v38/money.png', fullPage: true });
await ev(() => go('#/fixedcosts')); await P.waitForTimeout(400); await P.screenshot({ path: '/tmp/pgt/t/v38/fixed.png', fullPage: true });
ok(!errs.length, 'no page errors', errs);
await b.close();
